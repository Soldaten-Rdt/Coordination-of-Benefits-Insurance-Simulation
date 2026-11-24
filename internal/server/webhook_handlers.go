package server

import (
	"fmt"
	"net/http"
	"time"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/contracts"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"github.com/jackc/pgx/v5"
)

// T-206: Receive Claim Decision Callback from BPJS / Insurer (Webhook)
func (a *App) hospitalReceiveClaimResponseWebhook(w http.ResponseWriter, r *http.Request) {
	var bundle contracts.ClaimResponseBundle
	if !decodeJSON(w, r, &bundle) {
		return
	}

	if bundle.ClaimID == "" {
		response.Fail(w, http.StatusBadRequest, "INVALID_BUNDLE", "ClaimID is required")
		return
	}

	// 1. Locate subclaim
	var sc struct {
		ID              int64
		CaseID          int64
		PayerType       string
		PayerName       string
		RequestedAmount int64
		Status          string
	}
	err := a.db.QueryRow(r.Context(), `
		SELECT id, case_id, payer_type, payer_name, requested_amount, status
		FROM subclaims WHERE subclaim_code = $1`, bundle.ClaimID).
		Scan(&sc.ID, &sc.CaseID, &sc.PayerType, &sc.PayerName, &sc.RequestedAmount, &sc.Status)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "SUBCLAIM_NOT_FOUND", "Subclaim with code "+bundle.ClaimID+" not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SUBCLAIM_QUERY_FAILED", "Could not query subclaim")
		return
	}

	// 2. Load case details
	var c struct {
		CaseNumber        string
		PatientID         int64
		TotalHospitalBill int64
		WorkflowStep      int
	}
	err = a.db.QueryRow(r.Context(), `
		SELECT case_number, patient_id, total_hospital_bill, workflow_step
		FROM medical_cases WHERE id = $1`, sc.CaseID).
		Scan(&c.CaseNumber, &c.PatientID, &c.TotalHospitalBill, &c.WorkflowStep)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_QUERY_FAILED", "Could not query case details")
		return
	}

	decidedAt := bundle.DecidedAt
	if decidedAt.IsZero() {
		decidedAt = time.Now().UTC()
	}

	// 3. Update subclaims table (Idempotent update)
	_, err = a.db.Exec(r.Context(), `
		UPDATE subclaims
		SET status = $1,
		    approved_amount = $2,
		    non_cover_deduction = $3,
		    deduction_reason = $4,
		    reviewer_name = $5,
		    reviewer_notes = $6,
		    last_synced_at = $7
		WHERE id = $8`,
		bundle.Decision, bundle.ApprovedAmount, bundle.NonCoverDeduction, bundle.DeductionReason,
		bundle.ReviewerName, bundle.ReviewerNotes, decidedAt, sc.ID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SUBCLAIM_UPDATE_FAILED", "Could not update subclaim")
		return
	}

	// 4. Reconcile Split Bill Simulation
	var bpjsApproved, insurerApproved int64
	_ = a.db.QueryRow(r.Context(), `
		SELECT
			COALESCE(SUM(approved_amount) FILTER (WHERE payer_type = 'BPJS' AND status = 'APPROVED'), 0),
			COALESCE(SUM(approved_amount) FILTER (WHERE payer_type = 'PRIVATE_INSURANCE' AND status = 'APPROVED'), 0)
		FROM subclaims WHERE case_id = $1`, sc.CaseID).
		Scan(&bpjsApproved, &insurerApproved)

	patientFinalExcess := c.TotalHospitalBill - bpjsApproved - insurerApproved
	if patientFinalExcess < 0 {
		patientFinalExcess = 0
	}

	_, _ = a.db.Exec(r.Context(), `
		UPDATE split_bill_simulations
		SET bpjs_approved = $1,
		    insurer_approved = $2,
		    patient_final_excess = $3,
		    updated_at = NOW()
		WHERE case_id = $4`,
		bpjsApproved, insurerApproved, patientFinalExcess, sc.CaseID)

	// 5. Check all subclaims for case workflow advance
	rows, err := a.db.Query(r.Context(), `SELECT status FROM subclaims WHERE case_id = $1`, sc.CaseID)
	hasRevision := false
	allApproved := true
	allDecided := true

	if err == nil {
		for rows.Next() {
			var st string
			if err = rows.Scan(&st); err == nil {
				if st == "REVISION_REQUIRED" {
					hasRevision = true
				}
				if st != "APPROVED" {
					allApproved = false
				}
				if st != "APPROVED" && st != "REJECTED" {
					allDecided = false
				}
			}
		}
		rows.Close()
	}

	var newCoordinationStatus string
	var newWorkflowStep = c.WorkflowStep

	if hasRevision {
		newCoordinationStatus = "ACTION_REQUIRED"
	} else if allApproved {
		newCoordinationStatus = "APPROVED"
		if newWorkflowStep < 5 {
			newWorkflowStep = 5 // Step 5: Rekonsiliasi Split
		}
	} else if allDecided {
		newCoordinationStatus = "SETTLED"
		if newWorkflowStep < 5 {
			newWorkflowStep = 5
		}
	} else {
		newCoordinationStatus = "IN_REVIEW"
	}

	_, _ = a.db.Exec(r.Context(), `
		UPDATE medical_cases
		SET coordination_status = $1,
		    workflow_step = $2,
		    updated_at = NOW()
		WHERE id = $3`, newCoordinationStatus, newWorkflowStep, sc.CaseID)

	// 6. Record Notification
	notifCategory := "CLAIM_" + bundle.Decision
	notifTitle := fmt.Sprintf("Keputusan Subklaim %s (%s)", sc.PayerName, bundle.Decision)
	notifMessage := fmt.Sprintf("Penjamin %s menetapkan status %s untuk subklaim %s. Disetujui: Rp %d. %s",
		sc.PayerName, bundle.Decision, bundle.ClaimID, bundle.ApprovedAmount, bundle.ReviewerNotes)

	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO notifications(case_id, subclaim_code, source_payer, category, title, message, is_read)
		VALUES($1, $2, $3, $4, $5, $6, FALSE)`,
		sc.CaseID, bundle.ClaimID, sc.PayerType, notifCategory, notifTitle, notifMessage)

	// 7. Record Case Communication
	commMessage := fmt.Sprintf("Hasil Adjudikasi [%s]: Disetujui Rp %d. Catatan: %s",
		bundle.Decision, bundle.ApprovedAmount, bundle.ReviewerNotes)
	if bundle.NonCoverDeduction > 0 {
		commMessage += fmt.Sprintf(" (Potongan non-cover: Rp %d - %s)", bundle.NonCoverDeduction, bundle.DeductionReason)
	}

	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO case_communications(case_id, subclaim_id, sender_role, sender_name, message)
		VALUES($1, $2, $3, $4, $5)`,
		sc.CaseID, sc.ID, sc.PayerType, bundle.ReviewerName, commMessage)

	// 8. Record Activity Log
	_ = recordActivity(a.db, r, sc.CaseID, c.PatientID, "CLAIM_DECISION_RECEIVED",
		fmt.Sprintf("Keputusan klaim %s diterima", bundle.ClaimID),
		fmt.Sprintf("Penjamin %s memberikan keputusan %s dengan persetujuan Rp %d",
			sc.PayerName, bundle.Decision, bundle.ApprovedAmount))

	response.OK(w, map[string]interface{}{
		"success":              true,
		"case_id":              sc.CaseID,
		"subclaim_code":        bundle.ClaimID,
		"decision":             bundle.Decision,
		"approved_amount":      bundle.ApprovedAmount,
		"patient_final_excess": patientFinalExcess,
		"workflow_step":        newWorkflowStep,
		"coordination_status":  newCoordinationStatus,
		"message":              "Keputusan penjamin berhasil direkonsiliasi",
	})
}

// T-206: Receive Inbound Message from Payer (Webhook)
func (a *App) hospitalReceiveInsurerMessageWebhook(w http.ResponseWriter, r *http.Request) {
	var msg contracts.CommunicationMessage
	if !decodeJSON(w, r, &msg) {
		return
	}

	if msg.ClaimID == "" {
		response.Fail(w, http.StatusBadRequest, "INVALID_PAYLOAD", "claimId is required")
		return
	}

	var sc struct {
		ID        int64
		CaseID    int64
		PayerType string
	}
	err := a.db.QueryRow(r.Context(), `
		SELECT id, case_id, payer_type
		FROM subclaims WHERE subclaim_code = $1`, msg.ClaimID).
		Scan(&sc.ID, &sc.CaseID, &sc.PayerType)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "SUBCLAIM_NOT_FOUND", "Referenced claim not found")
		return
	}

	var patientID int64
	_ = a.db.QueryRow(r.Context(), `SELECT patient_id FROM medical_cases WHERE id = $1`, sc.CaseID).Scan(&patientID)

	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO case_communications(case_id, subclaim_id, sender_role, sender_name, message)
		VALUES($1, $2, $3, $4, $5)`,
		sc.CaseID, sc.ID, msg.SenderRole, msg.SenderName, msg.Message)

	_, _ = a.db.Exec(r.Context(), `
		INSERT INTO notifications(case_id, subclaim_code, source_payer, category, title, message, is_read)
		VALUES($1, $2, $3, 'PAYER_MESSAGE', $4, $5, FALSE)`,
		sc.CaseID, msg.ClaimID, sc.PayerType, fmt.Sprintf("Pesan Baru dari %s", msg.SenderRole), msg.Message)

	_ = recordActivity(a.db, r, sc.CaseID, patientID, "MESSAGE_RECEIVED",
		"Pesan dari penjamin", fmt.Sprintf("[%s] %s: %s", msg.SenderRole, msg.SenderName, msg.Message))

	response.OK(w, map[string]interface{}{"status": "MESSAGE_RECEIVED"})
}
