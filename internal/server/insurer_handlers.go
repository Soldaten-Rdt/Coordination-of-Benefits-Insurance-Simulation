package server

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/contracts"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/httpclient"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/middleware"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"github.com/jackc/pgx/v5"
)

// T-204: Dashboard Summary for Private Insurance
func (a *App) insurerDashboardSummary(w http.ResponseWriter, r *http.Request) {
	p, _ := middleware.PrincipalFrom(r.Context())

	// Fetch user's entity name and authority limit
	var userEntity string
	var authorityLimit int64
	_ = a.db.QueryRow(r.Context(), `
		SELECT insurer_entity_name, authority_limit
		FROM insurer_users WHERE id = $1`, p.UserID).
		Scan(&userEntity, &authorityLimit)

	var total, pending, inReview, revision, approvedMonth, deductionsCount int
	var totalDeductionsAmount int64

	err := a.db.QueryRow(r.Context(), `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'SUBMITTED'),
			COUNT(*) FILTER (WHERE status = 'IN_REVIEW'),
			COUNT(*) FILTER (WHERE status = 'REVISION_REQUIRED'),
			COUNT(*) FILTER (WHERE status = 'APPROVED' AND decided_at >= date_trunc('month', current_date)),
			COUNT(*) FILTER (WHERE non_cover_deduction > 0 OR status = 'REJECTED'),
			COALESCE(SUM(non_cover_deduction), 0)
		FROM insurer_claims`).
		Scan(&total, &pending, &inReview, &revision, &approvedMonth, &deductionsCount, &totalDeductionsAmount)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "DASHBOARD_QUERY_FAILED", "Could not load insurer dashboard summary")
		return
	}

	// Decision distribution
	distRows, err := a.db.Query(r.Context(), `
		SELECT status, COUNT(*)
		FROM insurer_claims
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

	// Recent CoB secondary claims
	claimRows, err := a.db.Query(r.Context(), `
		SELECT subclaim_code, case_number, hospital_name, requested_amount, approved_amount,
		       non_cover_deduction, status, patient_snapshot->>'full_name' as patient_name,
		       policy_snapshot->>'plan_name' as plan_name, created_at
		FROM insurer_claims
		ORDER BY created_at DESC
		LIMIT 5`)
	recentClaims := make([]map[string]interface{}, 0)
	if err == nil {
		for claimRows.Next() {
			var code, caseNum, hosp, status, patName, planName string
			var reqAmt, appAmt, nonCov int64
			var cAt time.Time
			if err = claimRows.Scan(&code, &caseNum, &hosp, &reqAmt, &appAmt, &nonCov, &status, &patName, &planName, &cAt); err == nil {
				recentClaims = append(recentClaims, map[string]interface{}{
					"subclaim_code":       code,
					"case_number":         caseNum,
					"hospital_name":       hosp,
					"patient_name":        patName,
					"plan_name":           planName,
					"requested_amount":    reqAmt,
					"approved_amount":     appAmt,
					"non_cover_deduction": nonCov,
					"status":              status,
					"created_at":          cAt.Format(time.RFC3339),
				})
			}
		}
		claimRows.Close()
	}

	// Recent activity logs
	logRows, err := a.db.Query(r.Context(), `
		SELECT l.actor_name, l.action, l.notes, l.created_at, c.subclaim_code, c.case_number
		FROM insurer_claim_logs l
		JOIN insurer_claims c ON c.id = l.claim_id
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
			"total_claims":               total,
			"pending_review":             pending,
			"in_review":                  inReview,
			"revision_required":          revision,
			"approved_this_month":        approvedMonth,
			"rejected_or_deductions":     deductionsCount,
			"total_deductions_amount":    totalDeductionsAmount,
			"current_user_entity":        userEntity,
			"underwriter_authority_limit": authorityLimit,
		},
		"policy_parameters": map[string]interface{}{
			"cob_rule":                "Sekunder setelah BPJS Kesehatan (Primary)",
			"annual_limit_inpatient":  200000000,
			"room_daily_limit":        3500000,
			"non_cover_items_policy":  "Suplemen vitamin non-injeksi, obat herbal, BHP estetika/kenyamanan di luar klausul rawat inap",
		},
		"decision_distribution": distribution,
		"recent_claims":         recentClaims,
		"recent_activity":       recentLogs,
	})
}

// T-204: Claims List for Private Insurance
func (a *App) listInsurerClaims(w http.ResponseWriter, r *http.Request) {
	page, limit := pagination(r)
	q := "%" + strings.TrimSpace(r.URL.Query().Get("q")) + "%"
	filter := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("filter")))
	statusParam := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))
	insurerParam := strings.TrimSpace(r.URL.Query().Get("insurer_name"))

	where := `($1 = '%%' OR c.subclaim_code ILIKE $1 OR c.case_number ILIKE $1 OR c.patient_snapshot->>'full_name' ILIKE $1 OR c.hospital_name ILIKE $1)`
	args := []interface{}{q}

	if statusParam != "" && statusParam != "ALL" {
		args = append(args, statusParam)
		where += fmt.Sprintf(` AND c.status = $%d`, len(args))
	} else if filter != "" && filter != "ALL" {
		args = append(args, filter)
		where += fmt.Sprintf(` AND c.status = $%d`, len(args))
	}

	if insurerParam != "" {
		args = append(args, insurerParam)
		where += fmt.Sprintf(` AND (c.insurer_entity_name ILIKE $%d OR c.policy_snapshot->>'insurer_name' ILIKE $%d)`, len(args), len(args))
	}

	var total int
	err := a.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM insurer_claims c WHERE `+where, args...).Scan(&total)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CLAIM_QUERY_FAILED", "Could not count insurer claims")
		return
	}

	args = append(args, limit, (page-1)*limit)
	query := fmt.Sprintf(`
		SELECT jsonb_build_object(
			'id', c.id,
			'subclaim_code', c.subclaim_code,
			'case_number', c.case_number,
			'hospital_name', c.hospital_name,
			'insurer_entity_name', c.insurer_entity_name,
			'patient_name', c.patient_snapshot->>'full_name',
			'patient_nik', c.patient_snapshot->>'nik',
			'policy_number', c.policy_snapshot->>'card_or_policy_number',
			'plan_name', c.policy_snapshot->>'plan_name',
			'diagnosis_icd10', c.clinical_snapshot->>'diagnosis_icd10',
			'procedure_icd9', c.clinical_snapshot->>'procedure_icd9',
			'requested_amount', c.requested_amount,
			'approved_amount', c.approved_amount,
			'non_cover_deduction', c.non_cover_deduction,
			'deduction_reason', c.deduction_reason,
			'patient_excess_impact', c.patient_excess_impact,
			'status', c.status,
			'decided_at', c.decided_at,
			'created_at', c.created_at
		)::text
		FROM insurer_claims c
		WHERE %s
		ORDER BY c.created_at DESC
		LIMIT $%d OFFSET $%d`, where, len(args)-1, len(args))

	rows, err := a.db.Query(r.Context(), query, args...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CLAIM_QUERY_FAILED", "Could not load insurer claims")
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

// T-205: Receive Outbound ClaimBundle from Hospital (Webhook)
func (a *App) insurerReceiveClaimWebhook(w http.ResponseWriter, r *http.Request) {
	var bundle contracts.ClaimBundle
	if !decodeJSON(w, r, &bundle) {
		return
	}

	if bundle.ClaimID == "" || bundle.CaseNumber == "" {
		response.Fail(w, http.StatusBadRequest, "INVALID_BUNDLE", "ClaimID and CaseNumber are required")
		return
	}

	hospitalName := "RS Jantung Nusantara"
	insurerEntity := "PT Asuransi Sehat Sentosa"
	if covName, ok := bundle.Coverage["insurer_name"].(string); ok && covName != "" {
		insurerEntity = covName
	}

	var reqAmount int64
	if bundle.Financial != nil {
		reqAmount = extractInt64(bundle.Financial["requested_amount"])
	}

	patJSON, _ := json.Marshal(bundle.Patient)
	polJSON, _ := json.Marshal(bundle.Coverage)
	clinJSON, _ := json.Marshal(bundle.Clinical)
	costJSON, _ := json.Marshal(bundle.Financial)
	docsJSON, _ := json.Marshal(bundle.SupportingDocuments)

	var claimID int64
	err := a.db.QueryRow(r.Context(), `
		INSERT INTO insurer_claims(
			subclaim_code, case_number, hospital_name, insurer_entity_name,
			patient_snapshot, policy_snapshot, clinical_snapshot, cost_breakdown_snapshot,
			documents_snapshot, status, requested_amount, created_at
		)
		VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SUBMITTED', $10, NOW())
		ON CONFLICT(subclaim_code) DO UPDATE SET
			case_number = EXCLUDED.case_number,
			hospital_name = EXCLUDED.hospital_name,
			insurer_entity_name = EXCLUDED.insurer_entity_name,
			patient_snapshot = EXCLUDED.patient_snapshot,
			policy_snapshot = EXCLUDED.policy_snapshot,
			clinical_snapshot = EXCLUDED.clinical_snapshot,
			cost_breakdown_snapshot = EXCLUDED.cost_breakdown_snapshot,
			documents_snapshot = EXCLUDED.documents_snapshot,
			requested_amount = EXCLUDED.requested_amount,
			status = 'SUBMITTED'
		RETURNING id`,
		bundle.ClaimID, bundle.CaseNumber, hospitalName, insurerEntity, patJSON, polJSON, clinJSON, costJSON, docsJSON, reqAmount).
		Scan(&claimID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CLAIM_SAVE_FAILED", fmt.Sprintf("Could not save insurer claim: %v", err))
		return
	}

	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO insurer_claim_logs(claim_id, actor_name, action, notes)
		VALUES($1, 'Hospital System', 'CLAIM_SUBMITTED', 'Berkas klaim sekunder CoB diterima dari Rumah Sakit')`, claimID)

	response.OK(w, map[string]interface{}{
		"claim_id":      claimID,
		"subclaim_code": bundle.ClaimID,
		"status":        "SUBMITTED",
		"message":       "Claim received successfully by Private Insurance Simulator",
	})
}

// T-205: Receive Message from Hospital (Webhook)
func (a *App) insurerReceiveMessageWebhook(w http.ResponseWriter, r *http.Request) {
	var msg contracts.CommunicationMessage
	if !decodeJSON(w, r, &msg) {
		return
	}

	var claimID int64
	err := a.db.QueryRow(r.Context(), `SELECT id FROM insurer_claims WHERE subclaim_code = $1`, msg.ClaimID).Scan(&claimID)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "CLAIM_NOT_FOUND", "Referenced claim not found")
		return
	}

	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO insurer_claim_logs(claim_id, actor_name, action, notes)
		VALUES($1, $2, 'MESSAGE_RECEIVED', $3)`, claimID, msg.SenderName, msg.Message)

	response.OK(w, map[string]interface{}{"status": "MESSAGE_RECORDED"})
}

// T-205: Get Single Claim Detail for Private Insurance
func (a *App) getInsurerClaimDetail(w http.ResponseWriter, r *http.Request) {
	subclaimCode := r.PathValue("subclaimCode")
	if subclaimCode == "" {
		response.Fail(w, http.StatusBadRequest, "INVALID_CODE", "Subclaim code is required")
		return
	}

	var c struct {
		ID                  int64
		SubclaimCode        string
		CaseNumber          string
		HospitalName        string
		InsurerEntityName   string
		PatientSnapshot     json.RawMessage
		PolicySnapshot      json.RawMessage
		ClinicalSnapshot    json.RawMessage
		CostSnapshot        json.RawMessage
		DocsSnapshot        json.RawMessage
		Status              string
		RequestedAmount     int64
		NonCoverDeduction   int64
		DeductionReason     string
		ApprovedAmount      int64
		PatientExcessImpact int64
		ReviewerID          *int64
		ReviewerNotes       string
		DecidedAt           *time.Time
		CreatedAt           time.Time
	}

	err := a.db.QueryRow(r.Context(), `
		SELECT id, subclaim_code, case_number, hospital_name, insurer_entity_name,
		       patient_snapshot, policy_snapshot, clinical_snapshot, cost_breakdown_snapshot,
		       documents_snapshot, status, requested_amount, non_cover_deduction, deduction_reason,
		       approved_amount, patient_excess_impact, reviewer_id, reviewer_notes, decided_at, created_at
		FROM insurer_claims WHERE subclaim_code = $1`, subclaimCode).
		Scan(&c.ID, &c.SubclaimCode, &c.CaseNumber, &c.HospitalName, &c.InsurerEntityName,
			&c.PatientSnapshot, &c.PolicySnapshot, &c.ClinicalSnapshot, &c.CostSnapshot,
			&c.DocsSnapshot, &c.Status, &c.RequestedAmount, &c.NonCoverDeduction, &c.DeductionReason,
			&c.ApprovedAmount, &c.PatientExcessImpact, &c.ReviewerID, &c.ReviewerNotes,
			&c.DecidedAt, &c.CreatedAt)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CLAIM_NOT_FOUND", "Claim not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CLAIM_QUERY_FAILED", "Could not load insurer claim details")
		return
	}

	logRows, err := a.db.Query(r.Context(), `
		SELECT actor_name, action, notes, created_at
		FROM insurer_claim_logs WHERE claim_id = $1 ORDER BY created_at ASC`, c.ID)
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
		"id":                    c.ID,
		"subclaim_code":         c.SubclaimCode,
		"case_number":           c.CaseNumber,
		"hospital_name":         c.HospitalName,
		"insurer_entity_name":   c.InsurerEntityName,
		"patient":               c.PatientSnapshot,
		"policy":                c.PolicySnapshot,
		"clinical":              c.ClinicalSnapshot,
		"cost_breakdown":        c.CostSnapshot,
		"documents":             c.DocsSnapshot,
		"status":                c.Status,
		"requested_amount":      c.RequestedAmount,
		"non_cover_deduction":   c.NonCoverDeduction,
		"deduction_reason":      c.DeductionReason,
		"approved_amount":       c.ApprovedAmount,
		"patient_excess_impact": c.PatientExcessImpact,
		"reviewer_notes":        c.ReviewerNotes,
		"created_at":            c.CreatedAt.Format(time.RFC3339),
		"logs":                  logs,
	}
	if c.DecidedAt != nil {
		data["decided_at"] = c.DecidedAt.Format(time.RFC3339)
	}

	response.OK(w, data)
}

// T-205: Update Status (e.g. to IN_REVIEW)
func (a *App) patchInsurerClaimStatus(w http.ResponseWriter, r *http.Request) {
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
		UPDATE insurer_claims SET status = $1 WHERE subclaim_code = $2`, input.Status, subclaimCode)
	if err != nil || res.RowsAffected() == 0 {
		response.Fail(w, http.StatusNotFound, "CLAIM_NOT_FOUND", "Claim not found")
		return
	}

	note := input.Notes
	if note == "" {
		note = fmt.Sprintf("Status diubah menjadi %s", input.Status)
	}
	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO insurer_claim_logs(claim_id, actor_name, action, notes)
		VALUES((SELECT id FROM insurer_claims WHERE subclaim_code = $1), $2, 'STATUS_UPDATED', $3)`,
		subclaimCode, p.Name, note)

	response.OK(w, map[string]interface{}{"subclaim_code": subclaimCode, "status": input.Status})
}

// T-205: Adjudicate Preview (Simulation of Non-Cover Deductions & Excess Impact)
func (a *App) previewInsurerAdjudication(w http.ResponseWriter, r *http.Request) {
	subclaimCode := r.PathValue("subclaimCode")
	var input struct {
		NonCoverDeduction int64  `json:"non_cover_deduction"`
		DeductionReason   string `json:"deduction_reason"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}

	if input.NonCoverDeduction < 0 {
		response.Fail(w, http.StatusBadRequest, "INVALID_DEDUCTION", "Non-cover deduction must not be negative")
		return
	}

	var reqAmount int64
	var costJSON []byte
	err := a.db.QueryRow(r.Context(), `
		SELECT requested_amount, cost_breakdown_snapshot
		FROM insurer_claims WHERE subclaim_code = $1`, subclaimCode).
		Scan(&reqAmount, &costJSON)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CLAIM_NOT_FOUND", "Claim not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CLAIM_QUERY_FAILED", "Could not query claim")
		return
	}

	if input.NonCoverDeduction > reqAmount {
		response.Fail(w, http.StatusUnprocessableEntity, "DEDUCTION_EXCEEDS_REQUESTED",
			"Nominal potongan non-cover tidak boleh melebihi nominal pengajuan klaim")
		return
	}

	recommendedApproved := reqAmount - input.NonCoverDeduction

	// Parse cost breakdown to calculate total bill and initial patient excess
	var costMap map[string]interface{}
	_ = json.Unmarshal(costJSON, &costMap)

	var totalBill int64 = 125000000
	var primaryPayerApproved int64 = 37500000

	if val, ok := costMap["total_hospital_bill"]; ok {
		if amt := extractInt64(val); amt > 0 {
			totalBill = amt
		}
	}
	if val, ok := costMap["primary_payer_approved"]; ok {
		if amt := extractInt64(val); amt > 0 {
			primaryPayerApproved = amt
		}
	} else if val, ok := costMap["primary_payer_estimated"]; ok {
		if amt := extractInt64(val); amt > 0 {
			primaryPayerApproved = amt
		}
	}

	initialPatientExcess := totalBill - primaryPayerApproved - reqAmount
	if initialPatientExcess < 0 {
		initialPatientExcess = 0
	}

	patientAdditionalExcess := input.NonCoverDeduction
	finalPatientExcess := initialPatientExcess + patientAdditionalExcess

	var coveragePercent float64 = 0.0
	if totalBill > 0 {
		coveragePercent = math.Round((float64(recommendedApproved)/float64(totalBill)*100.0)*10) / 10
	}

	response.OK(w, map[string]interface{}{
		"requested_amount":                 reqAmount,
		"non_cover_deduction":              input.NonCoverDeduction,
		"recommended_approved_amount":      recommendedApproved,
		"initial_patient_excess":           initialPatientExcess,
		"patient_additional_excess":        patientAdditionalExcess,
		"final_patient_excess":             finalPatientExcess,
		"coverage_percentage_of_total_bill": coveragePercent,
	})
}

// T-205: Decide Claim Adjudication & Send Callback to Hospital
func (a *App) decideInsurerClaim(w http.ResponseWriter, r *http.Request) {
	subclaimCode := r.PathValue("subclaimCode")
	var input struct {
		Decision          string                   `json:"decision"`
		ApprovedAmount    *int64                   `json:"approved_amount"`
		NonCoverDeduction int64                    `json:"non_cover_deduction"`
		DeductionReason   string                   `json:"deduction_reason"`
		ReviewerNotes     string                   `json:"reviewer_notes"`
		DocumentStatuses  []map[string]interface{} `json:"document_statuses"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}

	input.Decision = strings.ToUpper(strings.TrimSpace(input.Decision))
	if input.Decision != "APPROVED" && input.Decision != "REVISION_REQUIRED" && input.Decision != "REJECTED" {
		response.Fail(w, http.StatusBadRequest, "INVALID_DECISION", "Decision must be APPROVED, REVISION_REQUIRED, or REJECTED")
		return
	}

	p, _ := middleware.PrincipalFrom(r.Context())

	// Check underwriter authority limit
	var authorityLimit int64
	_ = a.db.QueryRow(r.Context(), `SELECT authority_limit FROM insurer_users WHERE id = $1`, p.UserID).Scan(&authorityLimit)

	var claim struct {
		ID              int64
		CaseNumber      string
		RequestedAmount int64
	}
	err := a.db.QueryRow(r.Context(), `
		SELECT id, case_number, requested_amount
		FROM insurer_claims WHERE subclaim_code = $1`, subclaimCode).
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
			approvedAmount = claim.RequestedAmount - input.NonCoverDeduction
			if approvedAmount < 0 {
				approvedAmount = 0
			}
		}

		if authorityLimit > 0 && approvedAmount > authorityLimit {
			response.Fail(w, http.StatusForbidden, "EXCEEDS_AUTHORITY_LIMIT",
				fmt.Sprintf("Nominal persetujuan (Rp %s) melebihi batas otoritas Anda (Rp %s)",
					strconv.FormatInt(approvedAmount, 10), strconv.FormatInt(authorityLimit, 10)))
			return
		}
	} else {
		approvedAmount = 0
	}

	now := time.Now().UTC()
	patientExcessImpact := input.NonCoverDeduction

	// 1. Update insurer_claims
	_, err = a.db.Exec(r.Context(), `
		UPDATE insurer_claims
		SET status = $1, approved_amount = $2, non_cover_deduction = $3,
		    deduction_reason = $4, patient_excess_impact = $5,
		    reviewer_id = $6, reviewer_notes = $7, decided_at = $8
		WHERE id = $9`,
		input.Decision, approvedAmount, input.NonCoverDeduction, input.DeductionReason,
		patientExcessImpact, p.UserID, input.ReviewerNotes, now, claim.ID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "DECISION_SAVE_FAILED", "Could not save adjudication decision")
		return
	}

	// 2. Add log entry
	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO insurer_claim_logs(claim_id, actor_name, action, notes)
		VALUES($1, $2, $3, $4)`,
		claim.ID, p.Name, "CLAIM_DECIDED",
		fmt.Sprintf("Keputusan: %s. Disetujui: Rp %d. Potongan non-cover: Rp %d (%s). Catatan: %s",
			input.Decision, approvedAmount, input.NonCoverDeduction, input.DeductionReason, input.ReviewerNotes))

	// 3. Dispatch callback to Hospital Service
	hospitalBaseURL := getServiceURL("HOSPITAL_URL", "http://hospital-api:8081")
	callbackEndpoint := httpclient.Endpoint(hospitalBaseURL, "/api/webhooks/claim-response")

	responseBundle := contracts.ClaimResponseBundle{
		ResourceType:      "ClaimResponse",
		ClaimID:           subclaimCode,
		CaseNumber:        claim.CaseNumber,
		PayerType:         "PRIVATE_INSURANCE",
		Decision:          input.Decision,
		RequestedAmount:   claim.RequestedAmount,
		ApprovedAmount:    approvedAmount,
		NonCoverDeduction: input.NonCoverDeduction,
		DeductionReason:   input.DeductionReason,
		ReviewerName:      p.Name,
		ReviewerNotes:     input.ReviewerNotes,
		DocumentReviews:   input.DocumentStatuses,
		DecidedAt:         now,
	}

	client := httpclient.New("insurer")
	ctxTimeout, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	if err = client.PostJSON(ctxTimeout, callbackEndpoint, responseBundle); err != nil {
		_, _ = a.db.Exec(r.Context(), `
			INSERT INTO insurer_claim_logs(claim_id, actor_name, action, notes)
			VALUES($1, 'System', 'CALLBACK_FAILED', $2)`,
			claim.ID, fmt.Sprintf("Gagal mengirim webhook callback ke RS (%s): %v", callbackEndpoint, err))
	} else {
		_, _ = a.db.Exec(r.Context(), `
			INSERT INTO insurer_claim_logs(claim_id, actor_name, action, notes)
			VALUES($1, 'System', 'CALLBACK_SENT', 'Keputusan adjudikasi berhasil dikirimkan ke Hospital Service')`,
			claim.ID)
	}

	response.OK(w, map[string]interface{}{
		"subclaim_code":       subclaimCode,
		"decision":            input.Decision,
		"approved_amount":     approvedAmount,
		"non_cover_deduction": input.NonCoverDeduction,
		"deduction_reason":    input.DeductionReason,
		"reviewer_notes":      input.ReviewerNotes,
		"decided_at":          now.Format(time.RFC3339),
		"message":             "Keputusan adjudikasi klaim asuransi berhasil disimpan dan dikirimkan ke Rumah Sakit",
	})
}
