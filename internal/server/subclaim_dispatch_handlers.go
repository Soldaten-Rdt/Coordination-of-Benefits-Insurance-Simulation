package server

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/contracts"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/httpclient"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"github.com/jackc/pgx/v5"
)

func getServiceURL(envKey, fallback string) string {
	if val := strings.TrimSpace(os.Getenv(envKey)); val != "" {
		return val
	}
	return fallback
}

func (a *App) submitSubclaims(w http.ResponseWriter, r *http.Request) {
	caseID, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}

	// 1. Load case
	var c struct {
		ID                int64
		CaseNumber        string
		PatientID         int64
		CareType          string
		RoomName          string
		EntitledClass     string
		DPJPName          string
		AdmissionDate     time.Time
		DischargeDate     *time.Time
		DiagnosisICD10    string
		DiagnosisDesc     string
		ProcedureICD9     string
		ProcedureDesc     string
		INACBGCode        string
		INACBGTariff      int64
		TotalHospitalBill int64
		SimulationMode    string
		WorkflowStep      int
		CoordinationState string
		PaymentState      string
	}

	err = a.db.QueryRow(r.Context(), `
		SELECT id, case_number, patient_id, care_type, room_name, entitled_class, dpjp_name,
		       admission_date, discharge_date, diagnosis_icd10, diagnosis_desc, procedure_icd9,
		       procedure_desc, ina_cbg_code, ina_cbg_tariff, total_hospital_bill, simulation_mode,
		       workflow_step, coordination_status, payment_status
		FROM medical_cases WHERE id = $1`, caseID).
		Scan(&c.ID, &c.CaseNumber, &c.PatientID, &c.CareType, &c.RoomName, &c.EntitledClass, &c.DPJPName,
			&c.AdmissionDate, &c.DischargeDate, &c.DiagnosisICD10, &c.DiagnosisDesc, &c.ProcedureICD9,
			&c.ProcedureDesc, &c.INACBGCode, &c.INACBGTariff, &c.TotalHospitalBill, &c.SimulationMode,
			&c.WorkflowStep, &c.CoordinationState, &c.PaymentState)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CASE_NOT_FOUND", "Case was not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_QUERY_FAILED", "Could not load case")
		return
	}

	// 2. Validate split bill simulation is applied
	var splitApplied bool
	var bpjsEstimated, insurerEstimated, patientEstimated int64
	err = a.db.QueryRow(r.Context(), `
		SELECT is_applied, bpjs_estimated, insurer_estimated, patient_estimated
		FROM split_bill_simulations WHERE case_id = $1`, caseID).
		Scan(&splitApplied, &bpjsEstimated, &insurerEstimated, &patientEstimated)
	if err == pgx.ErrNoRows || !splitApplied {
		response.Fail(w, http.StatusUnprocessableEntity, "SPLIT_BILL_NOT_APPLIED",
			"Simulasi split bill harus dihitung dan diterapkan (apply) sebelum mengajukan subklaim")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_BILL_QUERY_FAILED", "Could not verify split bill status")
		return
	}

	// 3. Validate mandatory documents
	docRows, err := a.db.Query(r.Context(), `
		SELECT doc_type, target_payer, validation_status
		FROM case_documents
		WHERE case_id = $1 AND is_mandatory = TRUE AND (validation_status <> 'VALID' OR file_url = '')`, caseID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "DOCUMENT_CHECK_FAILED", "Could not verify required documents")
		return
	}
	defer docRows.Close()

	var missingDocs []response.FieldDetail
	for docRows.Next() {
		var docType, targetPayer, valStatus string
		if err = docRows.Scan(&docType, &targetPayer, &valStatus); err == nil {
			missingDocs = append(missingDocs, response.FieldDetail{
				Field:   fmt.Sprintf("documents.%s", docType),
				Message: fmt.Sprintf("Dokumen %s untuk %s wajib diunggah dan berstatus valid", docType, targetPayer),
			})
		}
	}
	if len(missingDocs) > 0 {
		response.Fail(w, http.StatusUnprocessableEntity, "MISSING_REQUIRED_DOCUMENTS",
			"Seluruh dokumen wajib untuk penjamin terkait harus berstatus valid dan terunggah sebelum pengajuan", missingDocs...)
		return
	}

	// 4. Fetch patient info
	var pat struct {
		ID          int64
		PatientCode string
		NIK         string
		FullName    string
		BirthDate   time.Time
		Gender      string
		Phone       string
		Email       string
		Address     string
	}
	err = a.db.QueryRow(r.Context(), `
		SELECT id, patient_code, nik, full_name, birth_date, gender, phone, email, address
		FROM patients WHERE id = $1`, c.PatientID).
		Scan(&pat.ID, &pat.PatientCode, &pat.NIK, &pat.FullName, &pat.BirthDate, &pat.Gender, &pat.Phone, &pat.Email, &pat.Address)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PATIENT_QUERY_FAILED", "Could not load patient details")
		return
	}

	// 5. Fetch bill items
	billItemRows, err := a.db.Query(r.Context(), `
		SELECT category, description, unit_info, unit_price, quantity, subtotal, bpjs_portion, insurer_portion, patient_portion
		FROM case_bill_items WHERE case_id = $1 ORDER BY id`, caseID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "BILL_QUERY_FAILED", "Could not load bill items")
		return
	}
	defer billItemRows.Close()

	var billItems []map[string]interface{}
	for billItemRows.Next() {
		var cat, desc, unitInfo string
		var unitPrice, subtotal, bpjsPortion, insurerPortion, patPortion int64
		var qty float64
		if err = billItemRows.Scan(&cat, &desc, &unitInfo, &unitPrice, &qty, &subtotal, &bpjsPortion, &insurerPortion, &patPortion); err == nil {
			billItems = append(billItems, map[string]interface{}{
				"category":        cat,
				"description":     desc,
				"unit_info":       unitInfo,
				"unit_price":      unitPrice,
				"quantity":        qty,
				"subtotal":        subtotal,
				"bpjs_portion":    bpjsPortion,
				"insurer_portion": insurerPortion,
				"patient_portion": patPortion,
			})
		}
	}

	// 6. Fetch subclaims to submit
	subclaimRows, err := a.db.Query(r.Context(), `
		SELECT sc.id, sc.subclaim_code, sc.coverage_id, sc.payer_type, sc.payer_name,
		       sc.sep_number, sc.requested_amount, sc.status,
		       COALESCE(pc.card_or_policy_number, ''), COALESCE(pc.care_class, ''),
		       COALESCE(pc.primary_faskes, ''), COALESCE(pc.plan_name, ''),
		       COALESCE(pc.annual_limit, 0), COALESCE(pc.remaining_limit, 0), COALESCE(pc.room_daily_limit, 0)
		FROM subclaims sc
		LEFT JOIN patient_coverages pc ON pc.id = sc.coverage_id
		WHERE sc.case_id = $1 AND sc.status IN ('DRAFT', 'REVISION_REQUIRED')`, caseID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SUBCLAIM_QUERY_FAILED", "Could not load subclaims")
		return
	}
	defer subclaimRows.Close()

	type subclaimItem struct {
		ID              int64
		Code            string
		CoverageID      *int64
		PayerType       string
		PayerName       string
		SEPNumber       string
		RequestedAmount int64
		Status          string
		PolicyNumber    string
		CareClass       string
		PrimaryFaskes   string
		PlanName        string
		AnnualLimit     int64
		RemainingLimit  int64
		RoomDailyLimit  int64
	}

	var pendingSubclaims []subclaimItem
	for subclaimRows.Next() {
		var item subclaimItem
		if err = subclaimRows.Scan(&item.ID, &item.Code, &item.CoverageID, &item.PayerType, &item.PayerName,
			&item.SEPNumber, &item.RequestedAmount, &item.Status, &item.PolicyNumber, &item.CareClass,
			&item.PrimaryFaskes, &item.PlanName, &item.AnnualLimit, &item.RemainingLimit, &item.RoomDailyLimit); err == nil {
			pendingSubclaims = append(pendingSubclaims, item)
		}
	}

	if len(pendingSubclaims) == 0 {
		response.Fail(w, http.StatusBadRequest, "NO_PENDING_SUBCLAIMS", "No draft or revision-pending subclaims found to submit")
		return
	}

	// 7. Dispatch each subclaim to corresponding payer gateway
	type dispatchedItem struct {
		id   int64
		code string
	}
	var dispatched []dispatchedItem
	var submittedCodes []string
	client := httpclient.New("hospital")
	dischargeStr := ""
	if c.DischargeDate != nil {
		dischargeStr = c.DischargeDate.Format("2006-01-02")
	}

	for _, sc := range pendingSubclaims {
		// Auto-generate SEP for BPJS if not yet present
		if sc.PayerType == "BPJS" && sc.SEPNumber == "" {
			sc.SEPNumber = fmt.Sprintf("0041R001%sV%06d", time.Now().Format("0106"), (c.ID*1000+sc.ID)%1000000)
			_, _ = a.db.Exec(r.Context(), `UPDATE subclaims SET sep_number = $1 WHERE id = $2`, sc.SEPNumber, sc.ID)
		}

		// Supporting documents for this payer
		docQueryRows, err := a.db.Query(r.Context(), `
			SELECT id, doc_type, file_name, file_url, file_size, mime_type, validation_status
			FROM case_documents
			WHERE case_id = $1 AND (target_payer = $2 OR target_payer = 'GENERAL') AND validation_status = 'VALID'`,
			caseID, sc.PayerType)
		var supportingDocs []map[string]interface{}
		if err == nil {
			for docQueryRows.Next() {
				var dID, fSize int64
				var dType, fName, fURL, mType, vStatus string
				if err = docQueryRows.Scan(&dID, &dType, &fName, &fURL, &fSize, &mType, &vStatus); err == nil {
					supportingDocs = append(supportingDocs, map[string]interface{}{
						"document_id":       dID,
						"doc_type":          dType,
						"file_name":         fName,
						"file_url":          fURL,
						"file_size":         fSize,
						"mime_type":         mType,
						"validation_status": vStatus,
					})
				}
			}
			docQueryRows.Close()
		}

		// Payer tier and financial data
		payerTier := "PRIMARY"
		if sc.PayerType == "PRIVATE_INSURANCE" {
			payerTier = "SECONDARY"
		}

		financialPayload := map[string]interface{}{
			"total_hospital_bill": c.TotalHospitalBill,
			"requested_amount":    sc.RequestedAmount,
			"bill_items":          billItems,
		}
		if sc.PayerType == "BPJS" {
			financialPayload["reference_tariff"] = c.INACBGTariff
			financialPayload["ina_cbg_code"] = c.INACBGCode
			financialPayload["sep_number"] = sc.SEPNumber
		} else {
			financialPayload["primary_payer_estimated"] = bpjsEstimated
			financialPayload["primary_payer_approved"] = bpjsEstimated
		}

		bundle := contracts.ClaimBundle{
			ResourceType:   "Claim",
			ClaimID:        sc.Code,
			CaseNumber:     c.CaseNumber,
			PayerTier:      payerTier,
			SimulationMode: c.SimulationMode,
			Patient: map[string]interface{}{
				"id":           pat.ID,
				"patient_code": pat.PatientCode,
				"nik":          pat.NIK,
				"full_name":    pat.FullName,
				"birth_date":   pat.BirthDate.Format("2006-01-02"),
				"gender":       pat.Gender,
				"phone":        pat.Phone,
				"email":        pat.Email,
				"address":      pat.Address,
			},
			Coverage: map[string]interface{}{
				"card_or_policy_number": sc.PolicyNumber,
				"care_class":            sc.CareClass,
				"primary_faskes":        sc.PrimaryFaskes,
				"plan_name":             sc.PlanName,
				"annual_limit":          sc.AnnualLimit,
				"remaining_limit":       sc.RemainingLimit,
				"room_daily_limit":      sc.RoomDailyLimit,
				"insurer_name":          sc.PayerName,
			},
			Clinical: map[string]interface{}{
				"care_type":      c.CareType,
				"room_name":      c.RoomName,
				"entitled_class": c.EntitledClass,
				"dpjp_name":      c.DPJPName,
				"admission_date": c.AdmissionDate.Format("2006-01-02"),
				"discharge_date": dischargeStr,
				"diagnosis_icd10": c.DiagnosisICD10,
				"diagnosis_desc":  c.DiagnosisDesc,
				"procedure_icd9":  c.ProcedureICD9,
				"procedure_desc":  c.ProcedureDesc,
			},
			Financial:           financialPayload,
			SupportingDocuments: supportingDocs,
		}

		var targetURL string
		if sc.PayerType == "BPJS" {
			base := getServiceURL("BPJS_URL", "http://bpjs-api:8082")
			targetURL = httpclient.Endpoint(base, "/api/webhooks/claims")
		} else {
			base := getServiceURL("INSURER_URL", "http://insurer-api:8083")
			targetURL = httpclient.Endpoint(base, "/api/webhooks/claims")
		}

		ctxTimeout, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()

		if err = client.PostJSON(ctxTimeout, targetURL, bundle); err != nil {
			response.Fail(w, http.StatusBadGateway, "PAYER_GATEWAY_UNAVAILABLE",
				fmt.Sprintf("Gagal menghubungi gateway penjamin %s (%s): %v", sc.PayerName, targetURL, err))
			return
		}

		dispatched = append(dispatched, dispatchedItem{id: sc.ID, code: sc.Code})
		submittedCodes = append(submittedCodes, sc.Code)
	}

	// 8. Update database inside transaction only after all dispatches succeed
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "TRANSACTION_START_FAILED", "Could not start database transaction")
		return
	}
	defer tx.Rollback(r.Context())

	for _, d := range dispatched {
		_, err = tx.Exec(r.Context(), `
			UPDATE subclaims
			SET status = 'SUBMITTED', last_synced_at = NOW()
			WHERE id = $1`, d.id)
		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "SUBCLAIM_UPDATE_FAILED", "Could not update subclaim state")
			return
		}
	}

	_, err = tx.Exec(r.Context(), `
		UPDATE medical_cases
		SET workflow_step = GREATEST(workflow_step, 4),
		    coordination_status = 'IN_REVIEW',
		    updated_at = NOW()
		WHERE id = $1`, caseID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_UPDATE_FAILED", "Could not update case workflow state")
		return
	}

	actorName, actorRole := actor(r)
	for _, code := range submittedCodes {
		_, _ = tx.Exec(r.Context(), `
			INSERT INTO case_communications(case_id, subclaim_id, sender_role, sender_name, message)
			VALUES($1, (SELECT id FROM subclaims WHERE subclaim_code = $2 LIMIT 1), 'HOSPITAL', $3, $4)`,
			caseID, code, actorName, fmt.Sprintf("Paket klaim %s berhasil dikirim ke penjamin untuk verifikasi", code))
	}

	if err = tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "TRANSACTION_COMMIT_FAILED", "Could not commit transaction")
		return
	}

	// 9. Record activity log
	_ = recordActivity(a.db, r, caseID, pat.ID, "SUBCLAIM_SUBMITTED",
		"Subklaim diajukan ke penjamin",
		fmt.Sprintf("Subklaim %s berhasil diajukan ke penjamin oleh %s (%s)", strings.Join(submittedCodes, ", "), actorName, actorRole))

	response.OK(w, map[string]interface{}{
		"case_id":             caseID,
		"case_number":         c.CaseNumber,
		"submitted_subclaims": submittedCodes,
		"workflow_step":       4,
		"coordination_status": "IN_REVIEW",
		"message":             "Subklaim berhasil diajukan ke penjamin",
	})
}

func (a *App) resubmitSubclaim(w http.ResponseWriter, r *http.Request) {
	caseID, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	subclaimID, err := pathID(r, "subclaimId")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Subclaim ID must be a positive integer")
		return
	}

	var input struct {
		Notes string `json:"notes"`
	}
	if r.Body != nil && r.ContentLength > 0 {
		if !decodeJSON(w, r, &input) {
			return
		}
	}

	// Verify subclaim exists and belongs to case
	var sc struct {
		ID              int64
		Code            string
		PayerType       string
		PayerName       string
		Status          string
		RequestedAmount int64
		SEPNumber       string
		CoverageID      *int64
	}
	err = a.db.QueryRow(r.Context(), `
		SELECT id, subclaim_code, payer_type, payer_name, status, requested_amount, sep_number, coverage_id
		FROM subclaims WHERE id = $1 AND case_id = $2`, subclaimID, caseID).
		Scan(&sc.ID, &sc.Code, &sc.PayerType, &sc.PayerName, &sc.Status, &sc.RequestedAmount, &sc.SEPNumber, &sc.CoverageID)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "SUBCLAIM_NOT_FOUND", "Subclaim was not found on this case")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SUBCLAIM_QUERY_FAILED", "Could not load subclaim")
		return
	}

	if sc.Status == "APPROVED" {
		response.Fail(w, http.StatusUnprocessableEntity, "ALREADY_APPROVED", "Subklaim telah disetujui penuh dan tidak memerlukan pengiriman ulang")
		return
	}

	// Load case & patient info for resubmission bundle
	var c struct {
		CaseNumber        string
		PatientID         int64
		CareType          string
		RoomName          string
		EntitledClass     string
		DPJPName          string
		AdmissionDate     time.Time
		DischargeDate     *time.Time
		DiagnosisICD10    string
		DiagnosisDesc     string
		ProcedureICD9     string
		ProcedureDesc     string
		INACBGCode        string
		INACBGTariff      int64
		TotalHospitalBill int64
		SimulationMode    string
	}
	err = a.db.QueryRow(r.Context(), `
		SELECT case_number, patient_id, care_type, room_name, entitled_class, dpjp_name,
		       admission_date, discharge_date, diagnosis_icd10, diagnosis_desc, procedure_icd9,
		       procedure_desc, ina_cbg_code, ina_cbg_tariff, total_hospital_bill, simulation_mode
		FROM medical_cases WHERE id = $1`, caseID).
		Scan(&c.CaseNumber, &c.PatientID, &c.CareType, &c.RoomName, &c.EntitledClass, &c.DPJPName,
			&c.AdmissionDate, &c.DischargeDate, &c.DiagnosisICD10, &c.DiagnosisDesc, &c.ProcedureICD9,
			&c.ProcedureDesc, &c.INACBGCode, &c.INACBGTariff, &c.TotalHospitalBill, &c.SimulationMode)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_QUERY_FAILED", "Could not load case")
		return
	}

	var pat struct {
		ID          int64
		PatientCode string
		NIK         string
		FullName    string
		BirthDate   time.Time
		Gender      string
		Phone       string
		Email       string
		Address     string
	}
	_ = a.db.QueryRow(r.Context(), `
		SELECT id, patient_code, nik, full_name, birth_date, gender, phone, email, address
		FROM patients WHERE id = $1`, c.PatientID).
		Scan(&pat.ID, &pat.PatientCode, &pat.NIK, &pat.FullName, &pat.BirthDate, &pat.Gender, &pat.Phone, &pat.Email, &pat.Address)

	// Supporting documents
	docQueryRows, _ := a.db.Query(r.Context(), `
		SELECT id, doc_type, file_name, file_url, file_size, mime_type, validation_status
		FROM case_documents
		WHERE case_id = $1 AND (target_payer = $2 OR target_payer = 'GENERAL') AND validation_status = 'VALID'`,
		caseID, sc.PayerType)
	var supportingDocs []map[string]interface{}
	if docQueryRows != nil {
		for docQueryRows.Next() {
			var dID, fSize int64
			var dType, fName, fURL, mType, vStatus string
			if err = docQueryRows.Scan(&dID, &dType, &fName, &fURL, &fSize, &mType, &vStatus); err == nil {
				supportingDocs = append(supportingDocs, map[string]interface{}{
					"document_id":       dID,
					"doc_type":          dType,
					"file_name":         fName,
					"file_url":          fURL,
					"file_size":         fSize,
					"mime_type":         mType,
					"validation_status": vStatus,
				})
			}
		}
		docQueryRows.Close()
	}

	dischargeStr := ""
	if c.DischargeDate != nil {
		dischargeStr = c.DischargeDate.Format("2006-01-02")
	}

	bundle := contracts.ClaimBundle{
		ResourceType:   "Claim",
		ClaimID:        sc.Code,
		CaseNumber:     c.CaseNumber,
		PayerTier:      "PRIMARY",
		SimulationMode: c.SimulationMode,
		Patient: map[string]interface{}{
			"id":           pat.ID,
			"patient_code": pat.PatientCode,
			"nik":          pat.NIK,
			"full_name":    pat.FullName,
			"birth_date":   pat.BirthDate.Format("2006-01-02"),
			"gender":       pat.Gender,
		},
		Coverage: map[string]interface{}{
			"insurer_name": sc.PayerName,
		},
		Clinical: map[string]interface{}{
			"care_type":      c.CareType,
			"admission_date": c.AdmissionDate.Format("2006-01-02"),
			"discharge_date": dischargeStr,
			"diagnosis_icd10": c.DiagnosisICD10,
			"procedure_icd9":  c.ProcedureICD9,
		},
		Financial: map[string]interface{}{
			"total_hospital_bill": c.TotalHospitalBill,
			"requested_amount":    sc.RequestedAmount,
			"resubmission_notes":  input.Notes,
		},
		SupportingDocuments: supportingDocs,
	}
	if sc.PayerType == "PRIVATE_INSURANCE" {
		bundle.PayerTier = "SECONDARY"
	}

	var targetURL string
	if sc.PayerType == "BPJS" {
		base := getServiceURL("BPJS_URL", "http://bpjs-api:8082")
		targetURL = httpclient.Endpoint(base, "/api/webhooks/claims")
	} else {
		base := getServiceURL("INSURER_URL", "http://insurer-api:8083")
		targetURL = httpclient.Endpoint(base, "/api/webhooks/claims")
	}

	client := httpclient.New("hospital")
	ctxTimeout, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	if err = client.PostJSON(ctxTimeout, targetURL, bundle); err != nil {
		response.Fail(w, http.StatusBadGateway, "PAYER_GATEWAY_UNAVAILABLE",
			fmt.Sprintf("Gagal mengirim ulang ke penjamin %s: %v", sc.PayerName, err))
		return
	}

	// Update subclaim to SUBMITTED
	_, _ = a.db.Exec(r.Context(), `
		UPDATE subclaims
		SET status = 'SUBMITTED', last_synced_at = NOW()
		WHERE id = $1`, sc.ID)

	_, _ = a.db.Exec(r.Context(), `
		UPDATE medical_cases
		SET coordination_status = 'IN_REVIEW', updated_at = NOW()
		WHERE id = $1`, caseID)

	actorName, _ := actor(r)
	notesText := input.Notes
	if notesText == "" {
		notesText = "Berkas revisi telah diunggah dan dikirim ulang"
	}

	_ = recordActivity(a.db, r, caseID, pat.ID, "SUBCLAIM_RESUBMITTED",
		"Subklaim dikirim ulang ke penjamin",
		fmt.Sprintf("Subklaim %s dikirim ulang oleh %s: %s", sc.Code, actorName, notesText))

	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO case_communications(case_id, subclaim_id, sender_role, sender_name, message)
		VALUES($1, $2, 'HOSPITAL', $3, $4)`,
		caseID, sc.ID, actorName, fmt.Sprintf("Kirim Ulang Revisi: %s", notesText))

	response.OK(w, map[string]interface{}{
		"subclaim_id":   sc.ID,
		"subclaim_code": sc.Code,
		"status":        "SUBMITTED",
		"message":       "Subklaim revisi berhasil dikirim ulang ke penjamin",
	})
}
