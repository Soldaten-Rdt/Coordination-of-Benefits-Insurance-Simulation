package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"github.com/jackc/pgx/v5"
)

func (a *App) getInvoice(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	var result []byte
	err = a.db.QueryRow(r.Context(), `
		SELECT jsonb_build_object(
			'invoice_number',format('SIM-INV/%s/%s-%s',to_char(mc.created_at,'YYYY'),to_char(mc.created_at,'MM'),lpad(mc.id::text,4,'0')),
			'case_number',mc.case_number,
			'patient',jsonb_build_object('full_name',p.full_name,'patient_code',p.patient_code,'room_info',mc.room_name,'admission_date',mc.admission_date),
			'summary',jsonb_build_object('total_hospital_bill',mc.total_hospital_bill,
				'total_approved_payers',COALESCE((SELECT SUM(approved_amount) FROM subclaims WHERE case_id=mc.id),0),
				'total_paid_received',COALESCE((SELECT SUM(amount) FROM payment_transactions WHERE case_id=mc.id),0),
				'remaining_open_balance',mc.total_hospital_bill-COALESCE((SELECT SUM(amount) FROM payment_transactions WHERE case_id=mc.id),0)),
			'bill_items',COALESCE((SELECT jsonb_agg(to_jsonb(bi)-'case_id' ORDER BY bi.id) FROM case_bill_items bi WHERE bi.case_id=mc.id),'[]'::jsonb),
			'allocations',jsonb_build_array(
				jsonb_build_object('payer_source','BPJS','label','BPJS Kesehatan (Penjamin Pertama)',
					'ratio_percent',CASE WHEN mc.total_hospital_bill=0 THEN 0 ELSE round(100.0*COALESCE((SELECT approved_amount FROM subclaims WHERE case_id=mc.id AND payer_type='BPJS' LIMIT 1),0)/mc.total_hospital_bill,2) END,
					'amount',COALESCE((SELECT approved_amount FROM subclaims WHERE case_id=mc.id AND payer_type='BPJS' LIMIT 1),0),
					'paid_amount',COALESCE((SELECT SUM(amount) FROM payment_transactions WHERE case_id=mc.id AND payer_source='BPJS'),0),
					'remaining_amount',GREATEST(0,COALESCE((SELECT approved_amount FROM subclaims WHERE case_id=mc.id AND payer_type='BPJS' LIMIT 1),0)-COALESCE((SELECT SUM(amount) FROM payment_transactions WHERE case_id=mc.id AND payer_source='BPJS'),0)),
					'status',COALESCE((SELECT status FROM subclaims WHERE case_id=mc.id AND payer_type='BPJS' LIMIT 1),'DRAFT')),
				jsonb_build_object('payer_source','PRIVATE_INSURANCE','label',COALESCE((SELECT payer_name FROM subclaims WHERE case_id=mc.id AND payer_type='PRIVATE_INSURANCE' LIMIT 1),'Asuransi Swasta'),
					'ratio_percent',CASE WHEN mc.total_hospital_bill=0 THEN 0 ELSE round(100.0*COALESCE((SELECT approved_amount FROM subclaims WHERE case_id=mc.id AND payer_type='PRIVATE_INSURANCE' LIMIT 1),0)/mc.total_hospital_bill,2) END,
					'amount',COALESCE((SELECT approved_amount FROM subclaims WHERE case_id=mc.id AND payer_type='PRIVATE_INSURANCE' LIMIT 1),0),
					'paid_amount',COALESCE((SELECT SUM(amount) FROM payment_transactions WHERE case_id=mc.id AND payer_source='PRIVATE_INSURANCE'),0),
					'remaining_amount',GREATEST(0,COALESCE((SELECT approved_amount FROM subclaims WHERE case_id=mc.id AND payer_type='PRIVATE_INSURANCE' LIMIT 1),0)-COALESCE((SELECT SUM(amount) FROM payment_transactions WHERE case_id=mc.id AND payer_source='PRIVATE_INSURANCE'),0)),
					'status',COALESCE((SELECT status FROM subclaims WHERE case_id=mc.id AND payer_type='PRIVATE_INSURANCE' LIMIT 1),'NOT_APPLICABLE')),
				jsonb_build_object('payer_source','PATIENT','label','Pasien / Keluarga (Co-Payment & Selisih)',
					'ratio_percent',CASE WHEN mc.total_hospital_bill=0 THEN 0 ELSE round(100.0*GREATEST(0,mc.total_hospital_bill-COALESCE((SELECT SUM(approved_amount) FROM subclaims WHERE case_id=mc.id),0))/mc.total_hospital_bill,2) END,
					'amount',GREATEST(0,mc.total_hospital_bill-COALESCE((SELECT SUM(approved_amount) FROM subclaims WHERE case_id=mc.id),0)),
					'paid_amount',COALESCE((SELECT SUM(amount) FROM payment_transactions WHERE case_id=mc.id AND payer_source='PATIENT'),0),
					'remaining_amount',GREATEST(0,mc.total_hospital_bill-COALESCE((SELECT SUM(approved_amount) FROM subclaims WHERE case_id=mc.id),0)-COALESCE((SELECT SUM(amount) FROM payment_transactions WHERE case_id=mc.id AND payer_source='PATIENT'),0)),
					'status',CASE WHEN mc.payment_status='PAID' THEN 'PAID' ELSE 'UNPAID' END)
			),
			'transactions',COALESCE((SELECT jsonb_agg(to_jsonb(pt)-'case_id' ORDER BY pt.paid_at DESC) FROM payment_transactions pt WHERE pt.case_id=mc.id),'[]'::jsonb)
		)::text FROM medical_cases mc JOIN patients p ON p.id=mc.patient_id WHERE mc.id=$1`, id).Scan(&result)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CASE_NOT_FOUND", "Case was not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INVOICE_QUERY_FAILED", "Could not load invoice")
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": json.RawMessage(result)})
}

func (a *App) sendPatientInvoice(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	var patientID int64
	var caseNumber string
	err = a.db.QueryRow(r.Context(), `SELECT patient_id,case_number FROM medical_cases WHERE id=$1`, id).Scan(&patientID, &caseNumber)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CASE_NOT_FOUND", "Case was not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INVOICE_SEND_FAILED", "Could not load invoice recipient")
		return
	}
	if err = recordActivity(a.db, r, id, patientID, "INVOICE_SENT", "Patient invoice shared", "Invoice for "+caseNumber+" was marked as sent"); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_LOG_FAILED", "Could not record invoice delivery")
		return
	}
	response.Message(w, http.StatusOK, "Invoice marked as sent to patient")
}

func (a *App) recordPayment(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	var input struct {
		PayerSource   string `json:"payer_source"`
		SubclaimID    *int64 `json:"subclaim_id"`
		PaidAt        string `json:"paid_at"`
		PaymentMethod string `json:"payment_method"`
		Amount        int64  `json:"amount"`
		BankReference string `json:"bank_reference"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	var details []response.FieldDetail
	if input.PayerSource != "BPJS" && input.PayerSource != "PRIVATE_INSURANCE" && input.PayerSource != "PATIENT" {
		details = append(details, response.FieldDetail{Field: "payer_source", Message: "Use BPJS, PRIVATE_INSURANCE or PATIENT"})
	}
	if input.Amount <= 0 {
		details = append(details, response.FieldDetail{Field: "amount", Message: "Payment amount must be greater than zero"})
	}
	if input.PaymentMethod == "" {
		details = append(details, response.FieldDetail{Field: "payment_method", Message: "Payment method is required"})
	}
	paidAt := time.Now().UTC()
	if input.PaidAt != "" {
		paidAt, err = time.Parse(time.RFC3339, input.PaidAt)
		if err != nil {
			details = append(details, response.FieldDetail{Field: "paid_at", Message: "Use RFC3339 timestamp format"})
		}
	}
	if len(details) > 0 {
		response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Payment details are invalid", details...)
		return
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_CREATE_FAILED", "Could not record payment")
		return
	}
	defer tx.Rollback(r.Context())
	var total, approved int64
	var status string
	var patientID int64
	err = tx.QueryRow(r.Context(), `
		SELECT mc.total_hospital_bill,mc.payment_status,mc.patient_id,
			COALESCE((SELECT SUM(approved_amount) FROM subclaims WHERE case_id=mc.id),0)
		FROM medical_cases mc WHERE mc.id=$1 FOR UPDATE`, id).Scan(&total, &status, &patientID, &approved)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CASE_NOT_FOUND", "Case was not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_CREATE_FAILED", "Could not load case balance")
		return
	}
	var allocation int64
	switch input.PayerSource {
	case "BPJS", "PRIVATE_INSURANCE":
		payerType := input.PayerSource
		err = tx.QueryRow(r.Context(), `SELECT COALESCE(SUM(approved_amount),0) FROM subclaims WHERE case_id=$1 AND payer_type=$2 AND status='APPROVED'`, id, payerType).Scan(&allocation)
		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "PAYMENT_CREATE_FAILED", "Could not load payer allocation")
			return
		}
		if input.SubclaimID != nil {
			var matches bool
			err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM subclaims WHERE id=$1 AND case_id=$2 AND payer_type=$3)`,
				*input.SubclaimID, id, payerType).Scan(&matches)
			if err != nil || !matches {
				response.Fail(w, http.StatusUnprocessableEntity, "INVALID_SUBCLAIM", "subclaim_id does not match the selected payer and case")
				return
			}
		}
	case "PATIENT":
		allocation = total - approved
		if allocation < 0 {
			allocation = 0
		}
	}
	var alreadyPaid int64
	if err = tx.QueryRow(r.Context(), `SELECT COALESCE(SUM(amount),0) FROM payment_transactions WHERE case_id=$1 AND payer_source=$2`, id, input.PayerSource).Scan(&alreadyPaid); err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_CREATE_FAILED", "Could not calculate remaining payer balance")
		return
	}
	remaining := allocation - alreadyPaid
	var allPaid int64
	if err = tx.QueryRow(r.Context(), `SELECT COALESCE(SUM(amount),0) FROM payment_transactions WHERE case_id=$1`, id).Scan(&allPaid); err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_CREATE_FAILED", "Could not calculate remaining case balance")
		return
	}
	if input.Amount > remaining || input.Amount > total-allPaid {
		response.Fail(w, http.StatusBadRequest, "OVERPAYMENT_NOT_ALLOWED", "Payment exceeds this payer's remaining balance",
			response.FieldDetail{Field: "amount", Message: fmt.Sprintf("Maximum payable amount is %d", max(min(remaining, total-allPaid), 0))})
		return
	}
	var paymentID int64
	err = tx.QueryRow(r.Context(), `SELECT nextval(pg_get_serial_sequence('payment_transactions','id'))`).Scan(&paymentID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_CREATE_FAILED", "Could not allocate transaction number")
		return
	}
	transactionCode := fmt.Sprintf("TRX-%d-%04d", time.Now().Year(), paymentID)
	payerLabel := map[string]string{
		"BPJS": "BPJS Kesehatan", "PRIVATE_INSURANCE": "Asuransi Swasta", "PATIENT": "Pasien / Keluarga",
	}[input.PayerSource]
	name, _ := actor(r)
	_, err = tx.Exec(r.Context(), `
		INSERT INTO payment_transactions(id,transaction_code,case_id,subclaim_id,payer_source,payer_label,payment_method,amount,bank_reference,cashier_name,paid_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		paymentID, transactionCode, id, input.SubclaimID, input.PayerSource, payerLabel, input.PaymentMethod,
		input.Amount, input.BankReference, name, paidAt)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_CREATE_FAILED", "Could not save payment transaction")
		return
	}
	var totalPaid int64
	if err = tx.QueryRow(r.Context(), `SELECT COALESCE(SUM(amount),0) FROM payment_transactions WHERE case_id=$1`, id).Scan(&totalPaid); err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_CREATE_FAILED", "Could not update case payment status")
		return
	}
	newStatus := "PARTIAL"
	step := 5
	if totalPaid == 0 {
		newStatus = "UNPAID"
		step = 0
	}
	if totalPaid >= total {
		newStatus = "PAID"
		step = 6
	}
	if _, err = tx.Exec(r.Context(), `UPDATE medical_cases SET payment_status=$2,workflow_step=GREATEST(workflow_step,$3),updated_at=NOW() WHERE id=$1`, id, newStatus, step); err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_CREATE_FAILED", "Could not update case payment status")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_CREATE_FAILED", "Could not save payment")
		return
	}
	if err = recordActivity(a.db, r, id, patientID, "PAYMENT_RECORDED", "Payment recorded", fmt.Sprintf("%s payment of %d recorded", input.PayerSource, input.Amount)); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_LOG_FAILED", "Payment was recorded but the activity log could not be written")
		return
	}
	response.Created(w, map[string]interface{}{
		"id": paymentID, "transaction_code": transactionCode, "payment_status": newStatus,
		"total_paid_received": totalPaid, "remaining_open_balance": max(total-totalPaid, 0),
	})
}

func (a *App) listPayments(w http.ResponseWriter, r *http.Request) {
	page, limit := pagination(r)
	status := r.URL.Query().Get("status")
	payer := r.URL.Query().Get("payer")
	q := "%" + strings.TrimSpace(r.URL.Query().Get("q")) + "%"
	where := `($1='%%' OR mc.case_number ILIKE $1 OR p.full_name ILIKE $1)`
	args := []interface{}{q}
	if status != "" && status != "ALL" {
		args = append(args, status)
		where += fmt.Sprintf(` AND mc.payment_status=$%d`, len(args))
	}
	if payer != "" && payer != "ALL" {
		args = append(args, payer)
		where += fmt.Sprintf(` AND EXISTS(SELECT 1 FROM payment_transactions px WHERE px.case_id=mc.id AND px.payer_source=$%d)`, len(args))
	}
	var total int
	if err := a.db.QueryRow(r.Context(), `SELECT COUNT(DISTINCT mc.id) FROM medical_cases mc JOIN patients p ON p.id=mc.patient_id WHERE `+where, args...).Scan(&total); err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_QUERY_FAILED", "Could not load payment cases")
		return
	}
	args = append(args, limit, (page-1)*limit)
	query := fmt.Sprintf(`
		SELECT jsonb_build_object('case_id',mc.id,'case_number',mc.case_number,'patient_name',p.full_name,
			'total_hospital_bill',mc.total_hospital_bill,'payment_status',mc.payment_status,
			'total_approved',COALESCE((SELECT SUM(approved_amount) FROM subclaims WHERE case_id=mc.id),0),
			'total_paid',COALESCE((SELECT SUM(amount) FROM payment_transactions WHERE case_id=mc.id),0),
			'transactions',COALESCE((SELECT jsonb_agg(to_jsonb(pt)-'case_id' ORDER BY pt.paid_at DESC) FROM payment_transactions pt WHERE pt.case_id=mc.id),'[]'::jsonb)
		)::text FROM medical_cases mc JOIN patients p ON p.id=mc.patient_id WHERE %s
		ORDER BY mc.created_at DESC LIMIT $%d OFFSET $%d`, where, len(args)-1, len(args))
	rows, err := a.db.Query(r.Context(), query, args...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_QUERY_FAILED", "Could not load payments")
		return
	}
	defer rows.Close()
	data := make([]json.RawMessage, 0)
	for rows.Next() {
		var item []byte
		if err = rows.Scan(&item); err != nil {
			response.Fail(w, http.StatusInternalServerError, "PAYMENT_QUERY_FAILED", "Could not load payments")
			return
		}
		data = append(data, append(json.RawMessage(nil), item...))
	}
	if err = rows.Err(); err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_QUERY_FAILED", "Could not load payments")
		return
	}
	response.List(w, data, page, limit, total)
}

func (a *App) paymentSummary(w http.ResponseWriter, r *http.Request) {
	var approved, received, waitingPayers, patientBalance int64
	err := a.db.QueryRow(r.Context(), `
		SELECT
			COALESCE((SELECT SUM(approved_amount) FROM subclaims),0),
			COALESCE((SELECT SUM(amount) FROM payment_transactions),0),
			COALESCE((SELECT SUM(GREATEST(0,s.approved_amount-COALESCE((SELECT SUM(pt.amount) FROM payment_transactions pt
				WHERE pt.case_id=s.case_id AND pt.payer_source=s.payer_type),0))) FROM subclaims s WHERE s.status='APPROVED'),0),
			COALESCE((SELECT SUM(GREATEST(0,mc.total_hospital_bill-COALESCE(sc.approved,0)-COALESCE(pt.paid,0))) FROM medical_cases mc
				LEFT JOIN (SELECT case_id,SUM(approved_amount) approved FROM subclaims GROUP BY case_id) sc ON sc.case_id=mc.id
				LEFT JOIN (SELECT case_id,SUM(amount) paid FROM payment_transactions WHERE payer_source='PATIENT' GROUP BY case_id) pt ON pt.case_id=mc.id
				WHERE mc.payment_status<>'PAID'),0)`).Scan(&approved, &received, &waitingPayers, &patientBalance)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PAYMENT_SUMMARY_FAILED", "Could not aggregate payments")
		return
	}
	response.OK(w, map[string]int64{
		"total_approved_payers": approved, "total_paid_received": received,
		"waiting_payer_transfers": waitingPayers, "remaining_patient_excess": patientBalance,
	})
}

func (a *App) bankReconciliation(w http.ResponseWriter, r *http.Request) {
	page, limit := pagination(r)
	var total int
	if err := a.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM payment_transactions`).Scan(&total); err != nil {
		response.Fail(w, http.StatusInternalServerError, "RECONCILIATION_QUERY_FAILED", "Could not load bank reconciliation")
		return
	}
	offset := (page - 1) * limit
	rows, err := a.db.Query(r.Context(), `
		SELECT jsonb_build_object('transaction_code',pt.transaction_code,'case_number',mc.case_number,
			'patient_name',p.full_name,'payer_source',pt.payer_source,'amount',pt.amount,
			'bank_reference',pt.bank_reference,'paid_at',pt.paid_at,'verification_status',pt.verification_status)::text
		FROM payment_transactions pt JOIN medical_cases mc ON mc.id=pt.case_id JOIN patients p ON p.id=mc.patient_id
		ORDER BY pt.paid_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "RECONCILIATION_QUERY_FAILED", "Could not load bank reconciliation")
		return
	}
	defer rows.Close()
	data := make([]json.RawMessage, 0)
	for rows.Next() {
		var item []byte
		if err = rows.Scan(&item); err != nil {
			response.Fail(w, http.StatusInternalServerError, "RECONCILIATION_QUERY_FAILED", "Could not load bank reconciliation")
			return
		}
		data = append(data, append(json.RawMessage(nil), item...))
	}
	if err = rows.Err(); err != nil {
		response.Fail(w, http.StatusInternalServerError, "RECONCILIATION_QUERY_FAILED", "Could not load bank reconciliation")
		return
	}
	response.List(w, data, page, limit, total)
}
