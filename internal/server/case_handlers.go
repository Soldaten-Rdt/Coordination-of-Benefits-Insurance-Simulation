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

type billItemInput struct {
	Category    string  `json:"category"`
	Description string  `json:"description"`
	UnitInfo    string  `json:"unit_info"`
	UnitPrice   int64   `json:"unit_price"`
	Quantity    float64 `json:"quantity"`
}

type caseInput struct {
	PatientID      int64           `json:"patient_id"`
	CareType       string          `json:"care_type"`
	RoomName       string          `json:"room_name"`
	EntitledClass  string          `json:"entitled_class"`
	DPJPName       string          `json:"dpjp_name"`
	AdmissionDate  string          `json:"admission_date"`
	DischargeDate  string          `json:"discharge_date"`
	DiagnosisICD10 string          `json:"diagnosis_icd10"`
	DiagnosisDesc  string          `json:"diagnosis_desc"`
	ProcedureICD9  string          `json:"procedure_icd9"`
	ProcedureDesc  string          `json:"procedure_desc"`
	INACBGCode     string          `json:"ina_cbg_code"`
	INACBGTariff   int64           `json:"ina_cbg_tariff"`
	SimulationMode string          `json:"simulation_mode"`
	BillItems      []billItemInput `json:"bill_items"`
}

func (a *App) createCase(w http.ResponseWriter, r *http.Request) {
	var input caseInput
	if !decodeJSON(w, r, &input) {
		return
	}
	var details []response.FieldDetail
	if input.PatientID < 1 {
		details = append(details, response.FieldDetail{Field: "patient_id", Message: "A patient is required"})
	}
	if strings.TrimSpace(input.DiagnosisICD10) == "" {
		details = append(details, response.FieldDetail{Field: "diagnosis_icd10", Message: "Primary diagnosis is required"})
	}
	if strings.TrimSpace(input.DPJPName) == "" {
		details = append(details, response.FieldDetail{Field: "dpjp_name", Message: "DPJP name is required"})
	}
	admission, err := time.Parse("2006-01-02", input.AdmissionDate)
	if err != nil {
		details = append(details, response.FieldDetail{Field: "admission_date", Message: "Use YYYY-MM-DD format"})
	}
	var discharge interface{}
	if input.DischargeDate != "" {
		parsed, parseErr := time.Parse("2006-01-02", input.DischargeDate)
		if parseErr != nil || (err == nil && parsed.Before(admission)) {
			details = append(details, response.FieldDetail{Field: "discharge_date", Message: "Discharge date must be valid and not before admission"})
		} else {
			discharge = parsed
		}
	}
	if len(input.BillItems) == 0 {
		details = append(details, response.FieldDetail{Field: "bill_items", Message: "At least one bill item is required"})
	}
	if input.CareType != "" && input.CareType != "RAWAT_INAP" && input.CareType != "RAWAT_JALAN" {
		details = append(details, response.FieldDetail{Field: "care_type", Message: "Use RAWAT_INAP or RAWAT_JALAN"})
	}
	if input.SimulationMode != "" && input.SimulationMode != "COB" && input.SimulationMode != "NON_COB" {
		details = append(details, response.FieldDetail{Field: "simulation_mode", Message: "Use COB or NON_COB"})
	}
	var total int64
	for index, item := range input.BillItems {
		if item.Category != "AKOMODASI" && item.Category != "TINDAKAN" && item.Category != "FARMASI" && item.Category != "LABORATORIUM" {
			details = append(details, response.FieldDetail{Field: fmt.Sprintf("bill_items[%d].category", index), Message: "Unsupported bill item category"})
		}
		if item.Description == "" || item.UnitPrice < 0 || item.Quantity <= 0 {
			details = append(details, response.FieldDetail{Field: fmt.Sprintf("bill_items[%d]", index), Message: "Description, non-negative unit price and positive quantity are required"})
			continue
		}
		amount := float64(item.UnitPrice) * item.Quantity
		if amount > float64(^uint64(0)>>1) || float64(int64(amount)) != amount {
			details = append(details, response.FieldDetail{Field: fmt.Sprintf("bill_items[%d]", index), Message: "Line subtotal must be a whole number within the supported range"})
			continue
		}
		if int64(amount) > int64(^uint64(0)>>1)-total {
			details = append(details, response.FieldDetail{Field: "bill_items", Message: "Total bill exceeds supported range"})
			continue
		}
		total += int64(amount)
	}
	if len(details) > 0 {
		response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Case data is incomplete or invalid", details...)
		return
	}
	if input.CareType == "" {
		input.CareType = "RAWAT_INAP"
	}
	if input.SimulationMode == "" {
		if err = a.db.QueryRow(r.Context(), `SELECT value FROM system_configs WHERE key='simulation_mode'`).Scan(&input.SimulationMode); err != nil {
			response.Fail(w, http.StatusInternalServerError, "CONFIG_READ_FAILED", "Could not read the simulation mode")
			return
		}
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_CREATE_FAILED", "Could not create case")
		return
	}
	defer tx.Rollback(r.Context())
	var patientExists bool
	if err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM patients WHERE id=$1)`, input.PatientID).Scan(&patientExists); err != nil || !patientExists {
		response.Fail(w, http.StatusNotFound, "PATIENT_NOT_FOUND", "Patient was not found")
		return
	}
	var id int64
	err = tx.QueryRow(r.Context(), `SELECT nextval(pg_get_serial_sequence('medical_cases','id'))`).Scan(&id)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_CREATE_FAILED", "Could not assign case identifier")
		return
	}
	caseNumber := fmt.Sprintf("KAS-%d-%03d", time.Now().Year(), id)
	err = tx.QueryRow(r.Context(), `
		INSERT INTO medical_cases(id,case_number,patient_id,care_type,room_name,entitled_class,dpjp_name,admission_date,discharge_date,
			diagnosis_icd10,diagnosis_desc,procedure_icd9,procedure_desc,ina_cbg_code,ina_cbg_tariff,total_hospital_bill,simulation_mode)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
		id, caseNumber, input.PatientID, input.CareType, input.RoomName, input.EntitledClass, input.DPJPName, admission, discharge,
		input.DiagnosisICD10, input.DiagnosisDesc, input.ProcedureICD9, input.ProcedureDesc,
		input.INACBGCode, input.INACBGTariff, total, input.SimulationMode).Scan(&id)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_CREATE_FAILED", "Could not create case record")
		return
	}
	for _, item := range input.BillItems {
		subtotal := int64(float64(item.UnitPrice) * item.Quantity)
		if _, err = tx.Exec(r.Context(), `
			INSERT INTO case_bill_items(case_id,category,description,unit_info,unit_price,quantity,subtotal)
			VALUES($1,$2,$3,$4,$5,$6,$7)`, id, item.Category, item.Description, item.UnitInfo, item.UnitPrice, item.Quantity, subtotal); err != nil {
			response.Fail(w, http.StatusInternalServerError, "CASE_CREATE_FAILED", "Could not save bill items")
			return
		}
	}
	rows, err := tx.Query(r.Context(), `SELECT payer_type FROM patient_coverages WHERE patient_id=$1 AND status='ACTIVE' AND (valid_until IS NULL OR valid_until>=CURRENT_DATE)`, input.PatientID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_CREATE_FAILED", "Could not load patient coverages")
		return
	}
	hasBPJS, hasPrivate := false, false
	for rows.Next() {
		var payer string
		if err = rows.Scan(&payer); err != nil {
			rows.Close()
			response.Fail(w, http.StatusInternalServerError, "CASE_CREATE_FAILED", "Could not load patient coverages")
			return
		}
		if payer == "BPJS" {
			hasBPJS = true
		}
		if payer == "PRIVATE_INSURANCE" {
			hasPrivate = true
		}
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_CREATE_FAILED", "Could not load patient coverages")
		return
	}
	if !hasBPJS {
		response.Fail(w, http.StatusUnprocessableEntity, "MISSING_PRIMARY_COVERAGE", "Patient must have active BPJS coverage")
		return
	}
	required := []struct{ target, kind string }{
		{"BPJS", "SEP"}, {"BPJS", "RESUME_MEDIS"}, {"BPJS", "BILLING_RINCI"},
	}
	if input.SimulationMode == "COB" && hasPrivate {
		required = append(required, struct{ target, kind string }{"PRIVATE_INSURANCE", "GL_ASURANSI"})
		required = append(required, struct{ target, kind string }{"PRIVATE_INSURANCE", "RINCIAN_BHP"})
	}
	for _, item := range required {
		if _, err = tx.Exec(r.Context(), `
			INSERT INTO case_documents(case_id,target_payer,doc_type,file_name,file_url,is_mandatory,is_critical_discharge,validation_status)
			VALUES($1,$2,$3,'','',TRUE,$4,'MISSING')`,
			id, item.target, item.kind, item.kind == "RESUME_MEDIS"); err != nil {
			response.Fail(w, http.StatusInternalServerError, "CASE_CREATE_FAILED", "Could not create document checklist")
			return
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_CREATE_FAILED", "Could not save case")
		return
	}
	if err = recordActivity(a.db, r, id, input.PatientID, "CASE_CREATED", "Care case created", "Case "+caseNumber+" created"); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_LOG_FAILED", "Case was created but the activity log could not be written")
		return
	}
	response.Created(w, map[string]interface{}{
		"id": id, "case_number": caseNumber, "total_hospital_bill": total,
		"workflow_step": 1, "simulation_mode": input.SimulationMode,
	})
}

func (a *App) listCases(w http.ResponseWriter, r *http.Request) {
	page, limit := pagination(r)
	tab := r.URL.Query().Get("tab")
	status := r.URL.Query().Get("status")
	q := "%" + strings.TrimSpace(r.URL.Query().Get("q")) + "%"
	where := `($1='%%' OR mc.case_number ILIKE $1 OR p.full_name ILIKE $1)`
	args := []interface{}{q}
	if status != "" && status != "ALL" {
		args = append(args, status)
		where += fmt.Sprintf(` AND mc.payment_status=$%d`, len(args))
	}
	switch tab {
	case "", "ALL":
	case "NEEDS_DOCUMENTS":
		where += ` AND EXISTS(SELECT 1 FROM case_documents d WHERE d.case_id=mc.id AND d.is_mandatory AND d.validation_status<>'VALID')`
	case "IN_REVIEW":
		where += ` AND EXISTS(SELECT 1 FROM subclaims s WHERE s.case_id=mc.id AND s.status IN ('SUBMITTED','IN_REVIEW'))`
	case "READY_RECONCILE":
		where += ` AND EXISTS(SELECT 1 FROM subclaims s WHERE s.case_id=mc.id AND s.status IN ('APPROVED','REJECTED'))`
	default:
		response.Fail(w, http.StatusBadRequest, "INVALID_FILTER", "Unsupported case tab")
		return
	}
	var total int
	if err := a.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM medical_cases mc JOIN patients p ON p.id=mc.patient_id WHERE `+where, args...).Scan(&total); err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_QUERY_FAILED", "Could not load cases")
		return
	}
	args = append(args, limit, (page-1)*limit)
	query := fmt.Sprintf(`
		SELECT jsonb_build_object('id',mc.id,'case_number',mc.case_number,'patient_id',p.id,'patient_name',p.full_name,
			'patient_code',p.patient_code,'care_type',mc.care_type,'room_name',mc.room_name,'diagnosis_icd10',mc.diagnosis_icd10,
			'total_hospital_bill',mc.total_hospital_bill,'workflow_step',mc.workflow_step,'coordination_status',mc.coordination_status,
			'payment_status',mc.payment_status,'simulation_mode',mc.simulation_mode,'created_at',mc.created_at)::text
		FROM medical_cases mc JOIN patients p ON p.id=mc.patient_id WHERE %s ORDER BY mc.created_at DESC LIMIT $%d OFFSET $%d`,
		where, len(args)-1, len(args))
	rows, err := a.db.Query(r.Context(), query, args...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_QUERY_FAILED", "Could not load cases")
		return
	}
	defer rows.Close()
	data := make([]json.RawMessage, 0)
	for rows.Next() {
		var item []byte
		if err = rows.Scan(&item); err != nil {
			response.Fail(w, http.StatusInternalServerError, "CASE_QUERY_FAILED", "Could not load cases")
			return
		}
		data = append(data, append(json.RawMessage(nil), item...))
	}
	if err = rows.Err(); err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_QUERY_FAILED", "Could not load cases")
		return
	}
	response.List(w, data, page, limit, total)
}

func (a *App) getCase(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	var result []byte
	err = a.db.QueryRow(r.Context(), `
		SELECT jsonb_build_object(
			'id',mc.id,'case_number',mc.case_number,'patient',jsonb_build_object('id',p.id,'patient_code',p.patient_code,'full_name',p.full_name,'nik',p.nik),
			'care_type',mc.care_type,'room_name',mc.room_name,'entitled_class',mc.entitled_class,'dpjp_name',mc.dpjp_name,
			'admission_date',mc.admission_date,'discharge_date',mc.discharge_date,'diagnosis_icd10',mc.diagnosis_icd10,
			'diagnosis_desc',mc.diagnosis_desc,'procedure_icd9',mc.procedure_icd9,'procedure_desc',mc.procedure_desc,
			'ina_cbg_code',mc.ina_cbg_code,'ina_cbg_tariff',mc.ina_cbg_tariff,'total_hospital_bill',mc.total_hospital_bill,
			'simulation_mode',mc.simulation_mode,'workflow_step',mc.workflow_step,'coordination_status',mc.coordination_status,
			'payment_status',mc.payment_status,'discharge_documents_complete',mc.discharge_documents_complete,
			'bill_items',COALESCE((SELECT jsonb_agg(to_jsonb(bi) - 'case_id' ORDER BY bi.id) FROM case_bill_items bi WHERE bi.case_id=mc.id),'[]'::jsonb),
			'subclaims',COALESCE((SELECT jsonb_agg(to_jsonb(sc) - 'case_id' ORDER BY sc.id) FROM subclaims sc WHERE sc.case_id=mc.id),'[]'::jsonb),
			'documents',COALESCE((SELECT jsonb_agg(to_jsonb(d) - 'case_id' ORDER BY d.id) FROM case_documents d WHERE d.case_id=mc.id),'[]'::jsonb),
			'split_bill',(SELECT to_jsonb(sb) - 'case_id' FROM split_bill_simulations sb WHERE sb.case_id=mc.id),
			'communications',COALESCE((SELECT jsonb_agg(to_jsonb(cm) - 'case_id' ORDER BY cm.created_at) FROM case_communications cm WHERE cm.case_id=mc.id),'[]'::jsonb),
			'activities',COALESCE((SELECT jsonb_agg(to_jsonb(al) - 'case_id' ORDER BY al.created_at DESC) FROM activity_logs al WHERE al.case_id=mc.id),'[]'::jsonb)
		)::text FROM medical_cases mc JOIN patients p ON p.id=mc.patient_id WHERE mc.id=$1`, id).Scan(&result)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CASE_NOT_FOUND", "Case was not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_QUERY_FAILED", "Could not load case details")
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": json.RawMessage(result)})
}

func (a *App) updateCase(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	var input struct {
		RoomName      *string `json:"room_name"`
		EntitledClass *string `json:"entitled_class"`
		DPJPName      *string `json:"dpjp_name"`
		DischargeDate *string `json:"discharge_date"`
		DiagnosisDesc *string `json:"diagnosis_desc"`
		ProcedureDesc *string `json:"procedure_desc"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	var discharge interface{}
	if input.DischargeDate != nil {
		if *input.DischargeDate == "" {
			discharge = nil
		} else {
			parsed, parseErr := time.Parse("2006-01-02", *input.DischargeDate)
			if parseErr != nil {
				response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "discharge_date must use YYYY-MM-DD")
				return
			}
			discharge = parsed
		}
	}
	tag, err := a.db.Exec(r.Context(), `
		UPDATE medical_cases SET room_name=COALESCE($2,room_name),entitled_class=COALESCE($3,entitled_class),
			dpjp_name=COALESCE($4,dpjp_name),discharge_date=CASE WHEN $5 THEN $6::date ELSE discharge_date END,
			diagnosis_desc=COALESCE($7,diagnosis_desc),procedure_desc=COALESCE($8,procedure_desc),updated_at=NOW()
		WHERE id=$1`, id, input.RoomName, input.EntitledClass, input.DPJPName, input.DischargeDate != nil, discharge,
		input.DiagnosisDesc, input.ProcedureDesc)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CASE_UPDATE_FAILED", "Could not update case")
		return
	}
	if tag.RowsAffected() == 0 {
		response.Fail(w, http.StatusNotFound, "CASE_NOT_FOUND", "Case was not found")
		return
	}
	if err = recordActivity(a.db, r, id, 0, "CASE_UPDATED", "Care case updated", "Case details updated"); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_LOG_FAILED", "Case was updated but the activity log could not be written")
		return
	}
	response.Message(w, http.StatusOK, "Case updated")
}

func (a *App) updateDischargeChecklist(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	var input struct {
		Complete bool `json:"complete"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CHECKLIST_UPDATE_FAILED", "Could not update discharge checklist")
		return
	}
	defer tx.Rollback(r.Context())
	var patientID int64
	err = tx.QueryRow(r.Context(), `SELECT patient_id FROM medical_cases WHERE id=$1 FOR UPDATE`, id).Scan(&patientID)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CASE_NOT_FOUND", "Case was not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CHECKLIST_UPDATE_FAILED", "Could not load case")
		return
	}
	if input.Complete {
		var missing int
		err = tx.QueryRow(r.Context(), `
			SELECT COUNT(*) FROM case_documents WHERE case_id=$1 AND is_critical_discharge=TRUE AND validation_status<>'VALID'`, id).Scan(&missing)
		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "CHECKLIST_UPDATE_FAILED", "Could not verify critical documents")
			return
		}
		if missing > 0 {
			response.Fail(w, http.StatusUnprocessableEntity, "MISSING_CRITICAL_DOCUMENTS", "Required discharge documents are incomplete")
			return
		}
	}
	if _, err = tx.Exec(r.Context(), `UPDATE medical_cases SET discharge_documents_complete=$2 WHERE id=$1`, id, input.Complete); err != nil {
		response.Fail(w, http.StatusInternalServerError, "CHECKLIST_UPDATE_FAILED", "Could not save discharge checklist")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "CHECKLIST_UPDATE_FAILED", "Could not save discharge checklist")
		return
	}
	if err = recordActivity(a.db, r, id, patientID, "DISCHARGE_CHECKLIST_UPDATED", "Discharge checklist updated", fmt.Sprintf("Checklist complete: %t", input.Complete)); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_LOG_FAILED", "Checklist was updated but the activity log could not be written")
		return
	}
	response.OK(w, map[string]bool{"complete": input.Complete})
}
