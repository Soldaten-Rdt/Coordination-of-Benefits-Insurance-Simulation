package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/contracts"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/httpclient"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/middleware"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"github.com/jackc/pgx/v5"
)

// T-202: BPJS Dashboard Summary
func (a *App) bpjsDashboardSummary(w http.ResponseWriter, r *http.Request) {
	var total, pending, inReview, revision, approvedMonth int
	err := a.db.QueryRow(r.Context(), `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'SUBMITTED'),
			COUNT(*) FILTER (WHERE status = 'IN_REVIEW'),
			COUNT(*) FILTER (WHERE status = 'REVISION_REQUIRED'),
			COUNT(*) FILTER (WHERE status = 'APPROVED' AND decided_at >= date_trunc('month', current_date))
		FROM bpjs_claims`).
		Scan(&total, &pending, &inReview, &revision, &approvedMonth)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "DASHBOARD_QUERY_FAILED", "Could not load BPJS dashboard summary")
		return
	}

	// Priority queue with urgent SLA (< 24 hours remaining or submitted/in_review)
	priorityRows, err := a.db.Query(r.Context(), `
		SELECT subclaim_code, case_number, hospital_name, requested_amount, status, sla_deadline,
		       patient_snapshot->>'full_name' as patient_name
		FROM bpjs_claims
		WHERE status IN ('SUBMITTED', 'IN_REVIEW')
		ORDER BY sla_deadline ASC NULLS LAST, created_at ASC
		LIMIT 5`)
	priorityClaims := make([]map[string]interface{}, 0)
	if err == nil {
		for priorityRows.Next() {
			var code, caseNum, hosp, status, patName string
			var reqAmt int64
			var deadline *time.Time
			if err = priorityRows.Scan(&code, &caseNum, &hosp, &reqAmt, &status, &deadline, &patName); err == nil {
				item := map[string]interface{}{
					"subclaim_code":    code,
					"case_number":      caseNum,
					"hospital_name":    hosp,
					"requested_amount": reqAmt,
					"status":           status,
					"patient_name":     patName,
				}
				if deadline != nil {
					item["sla_deadline"] = deadline.Format(time.RFC3339)
					item["sla_remaining_hours"] = int(time.Until(*deadline).Hours())
				}
				priorityClaims = append(priorityClaims, item)
			}
		}
		priorityRows.Close()
	}

	// Top partner facilities
	faskesRows, err := a.db.Query(r.Context(), `
		SELECT hospital_name, COUNT(*) as claim_count, COALESCE(SUM(approved_amount), 0) as approved_total
		FROM bpjs_claims
		GROUP BY hospital_name
		ORDER BY claim_count DESC
		LIMIT 5`)
	faskesList := make([]map[string]interface{}, 0)
	if err == nil {
		for faskesRows.Next() {
			var hosp string
			var count, appTotal int64
			if err = faskesRows.Scan(&hosp, &count, &appTotal); err == nil {
				faskesList = append(faskesList, map[string]interface{}{
					"hospital_name":  hosp,
					"total_claims":   count,
					"approved_total": appTotal,
				})
			}
		}
		faskesRows.Close()
	}

	// Decision distribution
	distRows, err := a.db.Query(r.Context(), `
		SELECT status, COUNT(*)
		FROM bpjs_claims
		GROUP BY status`)
	distribution := map[string]int{
		"SUBMITTED":         0,
		"IN_REVIEW":         0,
		"APPROVED":          0,
		"REVISION_REQUIRED": 0,
		"REJECTED":          0,
	}
	if err == nil {
		for distRows.Next() {
			var st string
			var cnt int
			if err = distRows.Scan(&st, &cnt); err == nil {
				distribution[st] = cnt
			}
		}
		distRows.Close()
	}

	// Recent activity logs
	logRows, err := a.db.Query(r.Context(), `
		SELECT l.actor_name, l.action, l.notes, l.created_at, c.subclaim_code, c.case_number
		FROM bpjs_claim_logs l
		JOIN bpjs_claims c ON c.id = l.claim_id
		ORDER BY l.created_at DESC
		LIMIT 10`)
	recentLogs := make([]map[string]interface{}, 0)
	if err == nil {
		for logRows.Next() {
			var actor, action, notes, code, caseNum string
			var createdAt time.Time
			if err = logRows.Scan(&actor, &action, &notes, &createdAt, &code, &caseNum); err == nil {
				recentLogs = append(recentLogs, map[string]interface{}{
					"actor_name":    actor,
					"action":        action,
					"notes":         notes,
					"created_at":    createdAt.Format(time.RFC3339),
					"subclaim_code": code,
					"case_number":   caseNum,
				})
			}
		}
		logRows.Close()
	}

	response.OK(w, map[string]interface{}{
		"kpi": map[string]interface{}{
			"total_claims":        total,
			"pending_review":      pending,
			"in_review":           inReview,
			"revision_required":   revision,
			"approved_this_month": approvedMonth,
		},
		"decision_distribution": distribution,
		"priority_claims":       priorityClaims,
		"faskes_mitra":          faskesList,
		"recent_activity":       recentLogs,
	})
}

// T-202: BPJS Claims List
func (a *App) listBPJSClaims(w http.ResponseWriter, r *http.Request) {
	page, limit := pagination(r)
	q := "%" + strings.TrimSpace(r.URL.Query().Get("q")) + "%"
	filter := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("filter")))
	statusParam := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))

	where := `($1 = '%%' OR c.subclaim_code ILIKE $1 OR c.case_number ILIKE $1 OR c.patient_snapshot->>'full_name' ILIKE $1 OR c.hospital_name ILIKE $1)`
	args := []interface{}{q}

	if statusParam != "" && statusParam != "ALL" {
		args = append(args, statusParam)
		where += fmt.Sprintf(` AND c.status = $%d`, len(args))
	}

	switch filter {
	case "SLA_URGENT":
		where += ` AND c.status IN ('SUBMITTED', 'IN_REVIEW') AND c.sla_deadline IS NOT NULL AND c.sla_deadline < (NOW() + INTERVAL '24 hours')`
	case "EXECUTIVE_INPATIENT":
		where += ` AND (c.clinical_snapshot->>'care_type' = 'RAWAT_INAP' OR c.coverage_snapshot->>'care_class' ILIKE '%Eksekutif%' OR c.coverage_snapshot->>'care_class' ILIKE '%1%')`
	}

	var total int
	err := a.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM bpjs_claims c WHERE `+where, args...).Scan(&total)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CLAIM_QUERY_FAILED", "Could not count BPJS claims")
		return
	}

	args = append(args, limit, (page-1)*limit)
	query := fmt.Sprintf(`
		SELECT jsonb_build_object(
			'id', c.id,
			'subclaim_code', c.subclaim_code,
			'case_number', c.case_number,
			'hospital_name', c.hospital_name,
			'patient_name', c.patient_snapshot->>'full_name',
			'patient_nik', c.patient_snapshot->>'nik',
			'care_class', c.coverage_snapshot->>'care_class',
			'diagnosis_icd10', c.clinical_snapshot->>'diagnosis_icd10',
			'procedure_icd9', c.clinical_snapshot->>'procedure_icd9',
			'requested_amount', c.requested_amount,
			'approved_amount', c.approved_amount,
			'status', c.status,
			'sla_deadline', c.sla_deadline,
			'decided_at', c.decided_at,
			'created_at', c.created_at
		)::text
		FROM bpjs_claims c
		WHERE %s
		ORDER BY c.created_at DESC
		LIMIT $%d OFFSET $%d`, where, len(args)-1, len(args))

	rows, err := a.db.Query(r.Context(), query, args...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CLAIM_QUERY_FAILED", "Could not load BPJS claims")
		return
	}
	defer rows.Close()

	data := make([]json.RawMessage, 0)
	for rows.Next() {
		var item []byte
		if err = rows.Scan(&item); err == nil {
			data = append(data, append(json.RawMessage(nil), item...))
		}
	}

	response.List(w, data, page, limit, total)
}

// T-203: Receive Outbound ClaimBundle from Hospital (Webhook)
func (a *App) bpjsReceiveClaimWebhook(w http.ResponseWriter, r *http.Request) {
	var bundle contracts.ClaimBundle
	if !decodeJSON(w, r, &bundle) {
		return
	}

	if bundle.ClaimID == "" || bundle.CaseNumber == "" {
		response.Fail(w, http.StatusBadRequest, "INVALID_BUNDLE", "ClaimID and CaseNumber are required")
		return
	}

	hospitalName := "RS Jantung Nusantara"
	if hName, ok := bundle.Coverage["hospital_name"].(string); ok && hName != "" {
		hospitalName = hName
	}

	var reqAmount int64
	if bundle.Financial != nil {
		reqAmount = extractInt64(bundle.Financial["requested_amount"])
	}

	patJSON, _ := json.Marshal(bundle.Patient)
	covJSON, _ := json.Marshal(bundle.Coverage)
	clinJSON, _ := json.Marshal(bundle.Clinical)
	finJSON, _ := json.Marshal(bundle.Financial)
	docsJSON, _ := json.Marshal(bundle.SupportingDocuments)

	slaDeadline := time.Now().Add(72 * time.Hour) // 3-day SLA

	// Upsert into bpjs_claims
	var claimID int64
	err := a.db.QueryRow(r.Context(), `
		INSERT INTO bpjs_claims(
			subclaim_code, case_number, hospital_name, patient_snapshot, coverage_snapshot,
			clinical_snapshot, financial_snapshot, documents_snapshot, sla_deadline, status,
			requested_amount, created_at
		)
		VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SUBMITTED', $10, NOW())
		ON CONFLICT(subclaim_code) DO UPDATE SET
			case_number = EXCLUDED.case_number,
			hospital_name = EXCLUDED.hospital_name,
			patient_snapshot = EXCLUDED.patient_snapshot,
			coverage_snapshot = EXCLUDED.coverage_snapshot,
			clinical_snapshot = EXCLUDED.clinical_snapshot,
			financial_snapshot = EXCLUDED.financial_snapshot,
			documents_snapshot = EXCLUDED.documents_snapshot,
			requested_amount = EXCLUDED.requested_amount,
			status = 'SUBMITTED'
		RETURNING id`,
		bundle.ClaimID, bundle.CaseNumber, hospitalName, patJSON, covJSON, clinJSON, finJSON, docsJSON, slaDeadline, reqAmount).
		Scan(&claimID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CLAIM_SAVE_FAILED", fmt.Sprintf("Could not save claim: %v", err))
		return
	}

	// Add log entry
	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO bpjs_claim_logs(claim_id, actor_name, action, notes)
		VALUES($1, 'Hospital System', 'CLAIM_SUBMITTED', 'Berkas pengajuan klaim diterima dari Rumah Sakit')`, claimID)

	response.OK(w, map[string]interface{}{
		"claim_id":      claimID,
		"subclaim_code": bundle.ClaimID,
		"status":        "SUBMITTED",
		"message":       "Claim received successfully by BPJS Simulator",
	})
}

// T-203: Receive Message from Hospital (Webhook)
func (a *App) bpjsReceiveMessageWebhook(w http.ResponseWriter, r *http.Request) {
	var msg contracts.CommunicationMessage
	if !decodeJSON(w, r, &msg) {
		return
	}

	var claimID int64
	err := a.db.QueryRow(r.Context(), `SELECT id FROM bpjs_claims WHERE subclaim_code = $1`, msg.ClaimID).Scan(&claimID)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "CLAIM_NOT_FOUND", "Referenced claim not found")
		return
	}

	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO bpjs_claim_logs(claim_id, actor_name, action, notes)
		VALUES($1, $2, 'MESSAGE_RECEIVED', $3)`, claimID, msg.SenderName, msg.Message)

	response.OK(w, map[string]interface{}{"status": "MESSAGE_RECORDED"})
}

// T-203: Get Single Claim Detail
func (a *App) getBPJSClaimDetail(w http.ResponseWriter, r *http.Request) {
	subclaimCode := r.PathValue("subclaimCode")
	if subclaimCode == "" {
		response.Fail(w, http.StatusBadRequest, "INVALID_CODE", "Subclaim code is required")
		return
	}

	var c struct {
		ID               int64
		SubclaimCode     string
		CaseNumber       string
		HospitalName     string
		PatientSnapshot  json.RawMessage
		CoverageSnapshot json.RawMessage
		ClinicalSnapshot json.RawMessage
		FinancialSnapshot json.RawMessage
		DocsSnapshot     json.RawMessage
		SLADeadline      *time.Time
		Status           string
		RequestedAmount  int64
		ApprovedAmount   int64
		ComplianceChecks json.RawMessage
		ReviewerID       *int64
		ReviewerNotes    string
		DecidedAt        *time.Time
		CreatedAt        time.Time
	}

	err := a.db.QueryRow(r.Context(), `
		SELECT id, subclaim_code, case_number, hospital_name, patient_snapshot, coverage_snapshot,
		       clinical_snapshot, financial_snapshot, documents_snapshot, sla_deadline, status,
		       requested_amount, approved_amount, compliance_checks, reviewer_id, reviewer_notes,
		       decided_at, created_at
		FROM bpjs_claims WHERE subclaim_code = $1`, subclaimCode).
		Scan(&c.ID, &c.SubclaimCode, &c.CaseNumber, &c.HospitalName, &c.PatientSnapshot, &c.CoverageSnapshot,
			&c.ClinicalSnapshot, &c.FinancialSnapshot, &c.DocsSnapshot, &c.SLADeadline, &c.Status,
			&c.RequestedAmount, &c.ApprovedAmount, &c.ComplianceChecks, &c.ReviewerID, &c.ReviewerNotes,
			&c.DecidedAt, &c.CreatedAt)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CLAIM_NOT_FOUND", "Claim not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CLAIM_QUERY_FAILED", "Could not load claim details")
		return
	}

	// Fetch claim logs
	logRows, err := a.db.Query(r.Context(), `
		SELECT actor_name, action, notes, created_at
		FROM bpjs_claim_logs WHERE claim_id = $1 ORDER BY created_at ASC`, c.ID)
	var logs []map[string]interface{}
	if err == nil {
		for logRows.Next() {
			var actName, act, nts string
			var cAt time.Time
			if err = logRows.Scan(&actName, &act, &nts, &cAt); err == nil {
				logs = append(logs, map[string]interface{}{
					"actor_name": actName,
					"action":     act,
					"notes":      nts,
					"created_at": cAt.Format(time.RFC3339),
				})
			}
		}
		logRows.Close()
	}

	data := map[string]interface{}{
		"id":                 c.ID,
		"subclaim_code":      c.SubclaimCode,
		"case_number":        c.CaseNumber,
		"hospital_name":      c.HospitalName,
		"patient":            c.PatientSnapshot,
		"coverage":           c.CoverageSnapshot,
		"clinical":           c.ClinicalSnapshot,
		"financial":          c.FinancialSnapshot,
		"documents":          c.DocsSnapshot,
		"status":             c.Status,
		"requested_amount":   c.RequestedAmount,
		"approved_amount":    c.ApprovedAmount,
		"compliance_checks":  c.ComplianceChecks,
		"reviewer_notes":     c.ReviewerNotes,
		"created_at":         c.CreatedAt.Format(time.RFC3339),
		"logs":               logs,
	}
	if c.SLADeadline != nil {
		data["sla_deadline"] = c.SLADeadline.Format(time.RFC3339)
	}
	if c.DecidedAt != nil {
		data["decided_at"] = c.DecidedAt.Format(time.RFC3339)
	}

	response.OK(w, data)
}

// T-203: Update Status (e.g. to IN_REVIEW)
func (a *App) patchBPJSClaimStatus(w http.ResponseWriter, r *http.Request) {
	subclaimCode := r.PathValue("subclaimCode")
	var input struct {
		Status string `json:"status"`
		Notes  string `json:"notes"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}

	if input.Status != "SUBMITTED" && input.Status != "IN_REVIEW" && input.Status != "REVISION_REQUIRED" {
		response.Fail(w, http.StatusBadRequest, "INVALID_STATUS", "Invalid status value")
		return
	}

	p, _ := middleware.PrincipalFrom(r.Context())
	res, err := a.db.Exec(r.Context(), `
		UPDATE bpjs_claims SET status = $1 WHERE subclaim_code = $2`, input.Status, subclaimCode)
	if err != nil || res.RowsAffected() == 0 {
		response.Fail(w, http.StatusNotFound, "CLAIM_NOT_FOUND", "Claim not found")
		return
	}

	note := input.Notes
	if note == "" {
		note = fmt.Sprintf("Status diubah menjadi %s", input.Status)
	}
	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO bpjs_claim_logs(claim_id, actor_name, action, notes)
		VALUES((SELECT id FROM bpjs_claims WHERE subclaim_code = $1), $2, 'STATUS_UPDATED', $3)`,
		subclaimCode, p.Name, note)

	response.OK(w, map[string]interface{}{"subclaim_code": subclaimCode, "status": input.Status})
}

// T-203: Adjudicate Claim Decision (APPROVED / REVISION_REQUIRED / REJECTED) + Dispatch Callback
func (a *App) decideBPJSClaim(w http.ResponseWriter, r *http.Request) {
	subclaimCode := r.PathValue("subclaimCode")
	var input struct {
		Decision         string                   `json:"decision"`
		ApprovedAmount   *int64                   `json:"approved_amount"`
		ComplianceChecks map[string]interface{}   `json:"compliance_checks"`
		ReviewerNotes    string                   `json:"reviewer_notes"`
		DocumentStatuses []map[string]interface{} `json:"document_statuses"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}

	input.Decision = strings.ToUpper(strings.TrimSpace(input.Decision))
	if input.Decision != "APPROVED" && input.Decision != "REVISION_REQUIRED" && input.Decision != "REJECTED" {
		response.Fail(w, http.StatusBadRequest, "INVALID_DECISION", "Decision must be APPROVED, REVISION_REQUIRED, or REJECTED")
		return
	}

	var claim struct {
		ID              int64
		CaseNumber      string
		RequestedAmount int64
	}
	err := a.db.QueryRow(r.Context(), `
		SELECT id, case_number, requested_amount
		FROM bpjs_claims WHERE subclaim_code = $1`, subclaimCode).
		Scan(&claim.ID, &claim.CaseNumber, &claim.RequestedAmount)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CLAIM_NOT_FOUND", "Claim was not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CLAIM_QUERY_FAILED", "Could not query claim")
		return
	}

	var approvedAmount int64
	if input.Decision == "APPROVED" {
		if input.ApprovedAmount != nil && *input.ApprovedAmount >= 0 {
			approvedAmount = *input.ApprovedAmount
		} else {
			approvedAmount = claim.RequestedAmount
		}
	} else {
		approvedAmount = 0
	}

	complianceJSON, _ := json.Marshal(input.ComplianceChecks)
	p, _ := middleware.PrincipalFrom(r.Context())
	now := time.Now().UTC()

	// 1. Update bpjs_claims
	_, err = a.db.Exec(r.Context(), `
		UPDATE bpjs_claims
		SET status = $1, approved_amount = $2, compliance_checks = $3,
		    reviewer_id = $4, reviewer_notes = $5, decided_at = $6
		WHERE id = $7`,
		input.Decision, approvedAmount, complianceJSON, p.UserID, input.ReviewerNotes, now, claim.ID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "DECISION_SAVE_FAILED", "Could not save decision")
		return
	}

	// 2. Add log entry
	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO bpjs_claim_logs(claim_id, actor_name, action, notes)
		VALUES($1, $2, $3, $4)`,
		claim.ID, p.Name, "CLAIM_DECIDED", fmt.Sprintf("Keputusan: %s. Catatan: %s", input.Decision, input.ReviewerNotes))

	// 3. Dispatch callback to Hospital Service
	hospitalBaseURL := getServiceURL("HOSPITAL_URL", "http://hospital-api:8081")
	callbackEndpoint := httpclient.Endpoint(hospitalBaseURL, "/api/webhooks/claim-response")

	responseBundle := contracts.ClaimResponseBundle{
		ResourceType:      "ClaimResponse",
		ClaimID:           subclaimCode,
		CaseNumber:        claim.CaseNumber,
		PayerType:         "BPJS",
		Decision:          input.Decision,
		RequestedAmount:   claim.RequestedAmount,
		ApprovedAmount:    approvedAmount,
		NonCoverDeduction: 0,
		DeductionReason:   "",
		ReviewerName:      p.Name,
		ReviewerNotes:     input.ReviewerNotes,
		DocumentReviews:   input.DocumentStatuses,
		DecidedAt:         now,
	}

	client := httpclient.New("bpjs")
	ctxTimeout, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	if err = client.PostJSON(ctxTimeout, callbackEndpoint, responseBundle); err != nil {
		// Log warning but allow decision to persist in BPJS Simulator
		_, _ = a.db.Exec(r.Context(), `
			INSERT INTO bpjs_claim_logs(claim_id, actor_name, action, notes)
			VALUES($1, 'System', 'CALLBACK_FAILED', $2)`,
			claim.ID, fmt.Sprintf("Gagal mengirim webhook callback ke RS (%s): %v", callbackEndpoint, err))
	} else {
		_, _ = a.db.Exec(r.Context(), `
			INSERT INTO bpjs_claim_logs(claim_id, actor_name, action, notes)
			VALUES($1, 'System', 'CALLBACK_SENT', 'Keputusan berhasil dikirimkan ke Hospital Service')`,
			claim.ID)
	}

	response.OK(w, map[string]interface{}{
		"subclaim_code":   subclaimCode,
		"decision":        input.Decision,
		"approved_amount": approvedAmount,
		"reviewer_notes":  input.ReviewerNotes,
		"decided_at":      now.Format(time.RFC3339),
		"message":         "Keputusan verifikasi klaim berhasil disimpan dan dikirimkan ke Rumah Sakit",
	})
}
