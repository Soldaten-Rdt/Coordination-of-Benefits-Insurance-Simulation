package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"github.com/jackc/pgx/v5"
)

func pagination(r *http.Request) (int, int) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return page, limit
}

func (a *App) listPatients(w http.ResponseWriter, r *http.Request) {
	page, limit := pagination(r)
	q := "%" + strings.TrimSpace(r.URL.Query().Get("q")) + "%"
	payer := r.URL.Query().Get("payer")
	tab := r.URL.Query().Get("tab")
	where := `($1='%%' OR p.full_name ILIKE $1 OR p.nik ILIKE $1 OR p.patient_code ILIKE $1)`
	args := []interface{}{q}
	if payer != "" && payer != "ALL" {
		args = append(args, payer)
		where += fmt.Sprintf(` AND EXISTS(SELECT 1 FROM patient_coverages pc WHERE pc.patient_id=p.id AND pc.payer_type=$%d)`, len(args))
	}
	switch tab {
	case "ACTIVE_CASE":
		where += ` AND EXISTS(SELECT 1 FROM medical_cases mc WHERE mc.patient_id=p.id AND mc.payment_status<>'PAID')`
	case "ACTION_REQUIRED":
		where += ` AND EXISTS(SELECT 1 FROM medical_cases mc JOIN subclaims sc ON sc.case_id=mc.id WHERE mc.patient_id=p.id AND sc.status='REVISION_REQUIRED')`
	case "UNPAID":
		where += ` AND EXISTS(SELECT 1 FROM medical_cases mc WHERE mc.patient_id=p.id AND mc.payment_status IN ('UNPAID','PARTIAL'))`
	case "", "ALL":
	default:
		response.Fail(w, http.StatusBadRequest, "INVALID_FILTER", "Unsupported patient tab filter")
		return
	}
	var total int
	if err := a.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM patients p WHERE `+where, args...).Scan(&total); err != nil {
		response.Fail(w, http.StatusInternalServerError, "PATIENT_QUERY_FAILED", "Could not load patients")
		return
	}
	args = append(args, limit, (page-1)*limit)
	query := fmt.Sprintf(`
		SELECT jsonb_build_object(
			'id',p.id,'patient_code',p.patient_code,'full_name',p.full_name,'nik',p.nik,
			'age',date_part('year',age(current_date,p.birth_date))::int,'gender',p.gender,
			'coverages',COALESCE((SELECT jsonb_agg(jsonb_build_object(
				'id',pc.id,'payer_tier',pc.payer_tier,'payer_type',pc.payer_type,
				'insurer_name',pc.insurer_name,'card_or_policy_number',pc.card_or_policy_number,
				'care_class',pc.care_class,'annual_limit',pc.annual_limit,'remaining_limit',pc.remaining_limit
			) ORDER BY pc.payer_tier) FROM patient_coverages pc WHERE pc.patient_id=p.id),'[]'::jsonb),
			'cob_scheme_label',CASE WHEN EXISTS(SELECT 1 FROM patient_coverages x WHERE x.patient_id=p.id AND x.payer_type='PRIVATE_INSURANCE') THEN 'COB Ganda' ELSE 'BPJS Tunggal' END,
			'total_cases',(SELECT COUNT(*) FROM medical_cases mc WHERE mc.patient_id=p.id),
			'latest_case',(SELECT jsonb_build_object('id',mc.id,'case_number',mc.case_number,'care_type_label',mc.care_type,'coordination_status',mc.coordination_status,'payment_status',mc.payment_status)
				FROM medical_cases mc WHERE mc.patient_id=p.id ORDER BY mc.created_at DESC LIMIT 1)
		)::text
		FROM patients p WHERE %s ORDER BY p.created_at DESC LIMIT $%d OFFSET $%d`,
		where, len(args)-1, len(args))
	rows, err := a.db.Query(r.Context(), query, args...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PATIENT_QUERY_FAILED", "Could not load patients")
		return
	}
	defer rows.Close()
	data := make([]json.RawMessage, 0)
	for rows.Next() {
		var item []byte
		if err = rows.Scan(&item); err != nil {
			response.Fail(w, http.StatusInternalServerError, "PATIENT_QUERY_FAILED", "Could not load patients")
			return
		}
		data = append(data, append(json.RawMessage(nil), item...))
	}
	if err = rows.Err(); err != nil {
		response.Fail(w, http.StatusInternalServerError, "PATIENT_QUERY_FAILED", "Could not load patients")
		return
	}
	response.List(w, data, page, limit, total)
}

func (a *App) patientSummary(w http.ResponseWriter, r *http.Request) {
	var total, activeCases, action, unpaid int
	err := a.db.QueryRow(r.Context(), `
		SELECT
			(SELECT COUNT(*) FROM patients),
			(SELECT COUNT(*) FROM medical_cases WHERE payment_status<>'PAID'),
			(SELECT COUNT(DISTINCT mc.id) FROM medical_cases mc LEFT JOIN subclaims s ON s.case_id=mc.id WHERE s.status='REVISION_REQUIRED' OR mc.workflow_step<3),
			(SELECT COUNT(*) FROM medical_cases WHERE payment_status IN ('UNPAID','PARTIAL'))`).
		Scan(&total, &activeCases, &action, &unpaid)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SUMMARY_QUERY_FAILED", "Could not load patient summary")
		return
	}
	response.OK(w, map[string]int{
		"total_patients": total, "active_cases": activeCases,
		"cob_action_required": action, "waiting_payment": unpaid,
	})
}

func (a *App) verifyBPJS(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Number string `json:"bpjs_number"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if len(input.Number) != 13 || !digits(input.Number) {
		response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "BPJS number must contain 13 digits",
			response.FieldDetail{Field: "bpjs_number", Message: "Enter a 13-digit numeric BPJS number"})
		return
	}
	response.OK(w, map[string]interface{}{
		"bpjs_number": input.Number, "is_active": true, "participant_type": "PBI / Non-PBI Mandiri",
		"care_class": "Kelas 1 (Satu)", "primary_faskes": "Faskes Simulasi",
		"valid_until": "2026-12-31", "simulation": true,
	})
}

func digits(value string) bool {
	if value == "" {
		return false
	}
	for _, c := range value {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

type coverageInput struct {
	PayerTier      string `json:"payer_tier"`
	PayerType      string `json:"payer_type"`
	InsurerName    string `json:"insurer_name"`
	Number         string `json:"card_or_policy_number"`
	PolicyNumber   string `json:"policy_number"`
	CareClass      string `json:"care_class"`
	PrimaryFaskes  string `json:"primary_faskes"`
	PlanName       string `json:"plan_name"`
	AnnualLimit    int64  `json:"annual_limit"`
	RoomDailyLimit int64  `json:"room_daily_limit"`
	ValidUntil     string `json:"valid_until"`
}

type patientInput struct {
	FullName       string `json:"full_name"`
	NIK            string `json:"nik"`
	BirthDate      string `json:"birth_date"`
	Gender         string `json:"gender"`
	Phone          string `json:"phone"`
	Email          string `json:"email"`
	Address        string `json:"address"`
	EmergencyName  string `json:"emergency_contact_name"`
	EmergencyPhone string `json:"emergency_contact_phone"`
	BPJSNumber     string `json:"bpjs_number"`
	BPJSClass      string `json:"care_class"`
	PrimaryFaskes  string `json:"primary_faskes"`
	BPJS           *struct {
		Number        string `json:"bpjs_number"`
		CareClass     string `json:"care_class"`
		PrimaryFaskes string `json:"primary_faskes"`
	} `json:"bpjs_coverage"`
	PrivateCoverages  []coverageInput `json:"private_coverages"`
	IdentityDocuments []documentRef   `json:"identity_documents"`
}

func (a *App) createPatient(w http.ResponseWriter, r *http.Request) {
	var input patientInput
	if !decodeJSON(w, r, &input) {
		return
	}
	var details []response.FieldDetail
	if strings.TrimSpace(input.FullName) == "" {
		details = append(details, response.FieldDetail{Field: "full_name", Message: "Full name is required"})
	}
	if len(input.NIK) != 16 || !digits(input.NIK) {
		details = append(details, response.FieldDetail{Field: "nik", Message: "NIK must contain 16 digits"})
	}
	birthDate, err := time.Parse("2006-01-02", input.BirthDate)
	if err != nil || birthDate.After(time.Now()) {
		details = append(details, response.FieldDetail{Field: "birth_date", Message: "Use a valid birth date in YYYY-MM-DD format"})
	}
	if input.Gender != "L" && input.Gender != "P" {
		details = append(details, response.FieldDetail{Field: "gender", Message: "Gender must be L or P"})
	}
	if input.BPJSNumber != "" && (len(input.BPJSNumber) != 13 || !digits(input.BPJSNumber)) {
		details = append(details, response.FieldDetail{Field: "bpjs_number", Message: "BPJS number must contain 13 digits"})
	}
	if input.BPJS != nil {
		input.BPJSNumber = input.BPJS.Number
		input.BPJSClass = input.BPJS.CareClass
		input.PrimaryFaskes = input.BPJS.PrimaryFaskes
		if input.BPJSNumber != "" && (len(input.BPJSNumber) != 13 || !digits(input.BPJSNumber)) {
			details = append(details, response.FieldDetail{Field: "bpjs_coverage.bpjs_number", Message: "BPJS number must contain 13 digits"})
		}
	}
	if len(details) > 0 {
		response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Patient data is invalid", details...)
		return
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PATIENT_CREATE_FAILED", "Could not create patient")
		return
	}
	defer tx.Rollback(r.Context())
	var id int64
	err = tx.QueryRow(r.Context(), `SELECT nextval(pg_get_serial_sequence('patients','id'))`).Scan(&id)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PATIENT_CREATE_FAILED", "Could not assign patient identifier")
		return
	}
	code := fmt.Sprintf("PAT-%d-%03d", time.Now().Year(), id)
	err = tx.QueryRow(r.Context(), `
		INSERT INTO patients(id,patient_code,nik,full_name,birth_date,gender,phone,email,address,emergency_contact_name,emergency_contact_phone)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
		id, code, input.NIK, strings.TrimSpace(input.FullName), birthDate, input.Gender, input.Phone, input.Email,
		input.Address, input.EmergencyName, input.EmergencyPhone).Scan(&id)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
			response.Fail(w, http.StatusConflict, "DUPLICATE_NIK", "A patient with this NIK already exists")
			return
		}
		response.Fail(w, http.StatusInternalServerError, "PATIENT_CREATE_FAILED", "Could not create patient")
		return
	}
	if input.BPJSNumber != "" {
		_, err = tx.Exec(r.Context(), `
			INSERT INTO patient_coverages(patient_id,payer_tier,payer_type,insurer_name,card_or_policy_number,care_class,primary_faskes,valid_until)
			VALUES($1,'PRIMARY','BPJS','BPJS Kesehatan',$2,$3,$4,'2026-12-31')`,
			id, input.BPJSNumber, input.BPJSClass, input.PrimaryFaskes)
		if err != nil {
			response.Fail(w, http.StatusConflict, "DUPLICATE_COVERAGE", "BPJS number is already registered")
			return
		}
	}
	for i, coverage := range input.PrivateCoverages {
		if coverage.Number == "" {
			coverage.Number = coverage.PolicyNumber
		}
		tier := coverage.PayerTier
		if tier == "" {
			if i == 0 {
				tier = "SECONDARY"
			} else {
				tier = "TERTIARY"
			}
		}
		validUntil, parseErr := time.Parse("2006-01-02", coverage.ValidUntil)
		if parseErr != nil || coverage.Number == "" || coverage.InsurerName == "" ||
			(coverage.PayerTier != "" && tier != "SECONDARY" && tier != "TERTIARY") ||
			coverage.AnnualLimit < 0 || coverage.RoomDailyLimit < 0 {
			response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Private coverage data is invalid",
				response.FieldDetail{Field: "private_coverages", Message: "Each policy needs an insurer, policy number, valid date, and non-negative limits"})
			return
		}
		_, err = tx.Exec(r.Context(), `
			INSERT INTO patient_coverages(patient_id,payer_tier,payer_type,insurer_name,card_or_policy_number,plan_name,annual_limit,remaining_limit,room_daily_limit,valid_until)
			VALUES($1,$2,'PRIVATE_INSURANCE',$3,$4,$5,$6,$6,$7,$8)`,
			id, tier, coverage.InsurerName, coverage.Number, coverage.PlanName,
			coverage.AnnualLimit, coverage.RoomDailyLimit, validUntil)
		if err != nil {
			response.Fail(w, http.StatusConflict, "DUPLICATE_COVERAGE", "Policy number is already registered")
			return
		}
	}
	for _, doc := range input.IdentityDocuments {
		if doc.DocType == "" || doc.FileName == "" || !strings.HasPrefix(doc.FileURL, "/uploads/") {
			response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Identity document metadata is invalid",
				response.FieldDetail{Field: "identity_documents", Message: "Each document needs a type, file name, and /uploads/ URL"})
			return
		}
		if _, err = tx.Exec(r.Context(), `
			INSERT INTO case_documents(patient_id,target_payer,doc_type,file_name,file_url,is_mandatory,validation_status)
			VALUES($1,'GENERAL',$2,$3,$4,FALSE,'VALID')`, id, doc.DocType, doc.FileName, doc.FileURL); err != nil {
			response.Fail(w, http.StatusInternalServerError, "PATIENT_CREATE_FAILED", "Could not save identity document metadata")
			return
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "PATIENT_CREATE_FAILED", "Could not save patient")
		return
	}
	if err = recordActivity(a.db, r, 0, id, "PATIENT_CREATED", "Patient registered", "Patient "+code+" created"); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_LOG_FAILED", "Patient was created but the activity log could not be written")
		return
	}
	response.Created(w, map[string]interface{}{"id": id, "patient_code": code, "full_name": input.FullName})
}

type documentRef struct {
	DocType  string `json:"doc_type"`
	FileName string `json:"file_name"`
	FileURL  string `json:"file_url"`
}

func (a *App) getPatient(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Patient ID must be a positive integer")
		return
	}
	var patient []byte
	err = a.db.QueryRow(r.Context(), `
		SELECT jsonb_build_object('id',p.id,'patient_code',p.patient_code,'nik',p.nik,'full_name',p.full_name,
			'birth_date',p.birth_date,'gender',p.gender,'phone',p.phone,'email',p.email,'address',p.address,
			'emergency_contact_name',p.emergency_contact_name,'emergency_contact_phone',p.emergency_contact_phone,
			'coverages',COALESCE((SELECT jsonb_agg(to_jsonb(pc) - 'patient_id') FROM patient_coverages pc WHERE pc.patient_id=p.id),'[]'::jsonb),
			'cases',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',mc.id,'case_number',mc.case_number,'care_type',mc.care_type,'total_hospital_bill',mc.total_hospital_bill,'workflow_step',mc.workflow_step,'payment_status',mc.payment_status,'created_at',mc.created_at) ORDER BY mc.created_at DESC) FROM medical_cases mc WHERE mc.patient_id=p.id),'[]'::jsonb),
			'lifetime_claimed',COALESCE((SELECT SUM(sc.requested_amount) FROM subclaims sc JOIN medical_cases mc ON mc.id=sc.case_id WHERE mc.patient_id=p.id),0),
			'activities',COALESCE((SELECT jsonb_agg(jsonb_build_object('event_type',al.event_type,'title',al.title,'description',al.description,'created_at',al.created_at) ORDER BY al.created_at DESC) FROM activity_logs al WHERE al.patient_id=p.id),'[]'::jsonb)
		)::text FROM patients p WHERE p.id=$1`, id).Scan(&patient)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "PATIENT_NOT_FOUND", "Patient was not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PATIENT_QUERY_FAILED", "Could not load patient")
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": json.RawMessage(patient)})
}

func (a *App) updatePatient(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Patient ID must be a positive integer")
		return
	}
	var input struct {
		Phone                 *string `json:"phone"`
		Email                 *string `json:"email"`
		Address               *string `json:"address"`
		EmergencyContactName  *string `json:"emergency_contact_name"`
		EmergencyContactPhone *string `json:"emergency_contact_phone"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	tag, err := a.db.Exec(r.Context(), `
		UPDATE patients SET phone=COALESCE($2,phone),email=COALESCE($3,email),address=COALESCE($4,address),
			emergency_contact_name=COALESCE($5,emergency_contact_name),emergency_contact_phone=COALESCE($6,emergency_contact_phone)
		WHERE id=$1`, id, input.Phone, input.Email, input.Address, input.EmergencyContactName, input.EmergencyContactPhone)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PATIENT_UPDATE_FAILED", "Could not update patient")
		return
	}
	if tag.RowsAffected() == 0 {
		response.Fail(w, http.StatusNotFound, "PATIENT_NOT_FOUND", "Patient was not found")
		return
	}
	if err = recordActivity(a.db, r, 0, id, "PATIENT_UPDATED", "Patient profile updated", "Patient contact information updated"); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_LOG_FAILED", "Patient was updated but the activity log could not be written")
		return
	}
	response.Message(w, http.StatusOK, "Patient updated")
}

func (a *App) updateCoverages(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Patient ID must be a positive integer")
		return
	}
	var input struct {
		Coverages []struct {
			ID             int64  `json:"id"`
			AnnualLimit    int64  `json:"annual_limit"`
			RemainingLimit int64  `json:"remaining_limit"`
			RoomDailyLimit int64  `json:"room_daily_limit"`
			Status         string `json:"status"`
			ValidUntil     string `json:"valid_until"`
		} `json:"coverages"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "COVERAGE_UPDATE_FAILED", "Could not update coverage")
		return
	}
	defer tx.Rollback(r.Context())
	for _, c := range input.Coverages {
		if c.ID < 1 || c.AnnualLimit < 0 || c.RemainingLimit < 0 || c.RoomDailyLimit < 0 || c.RemainingLimit > c.AnnualLimit ||
			(c.Status != "" && c.Status != "ACTIVE" && c.Status != "INACTIVE" && c.Status != "EXPIRED") {
			response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Coverage values are invalid",
				response.FieldDetail{Field: "coverages", Message: "Limits must be non-negative and status must be ACTIVE, INACTIVE, or EXPIRED"})
			return
		}
		var validUntil interface{}
		if c.ValidUntil != "" {
			parsed, parseErr := time.Parse("2006-01-02", c.ValidUntil)
			if parseErr != nil {
				response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "valid_until must be YYYY-MM-DD")
				return
			}
			validUntil = parsed
		}
		tag, execErr := tx.Exec(r.Context(), `
			UPDATE patient_coverages SET annual_limit=$3,remaining_limit=$4,room_daily_limit=$5,
				status=COALESCE(NULLIF($6,''),status),valid_until=COALESCE($7,valid_until)
			WHERE id=$1 AND patient_id=$2`, c.ID, id, c.AnnualLimit, c.RemainingLimit, c.RoomDailyLimit, c.Status, validUntil)
		if execErr != nil {
			response.Fail(w, http.StatusInternalServerError, "COVERAGE_UPDATE_FAILED", "Could not update coverage")
			return
		}
		if tag.RowsAffected() == 0 {
			response.Fail(w, http.StatusNotFound, "COVERAGE_NOT_FOUND", "Coverage does not belong to this patient")
			return
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "COVERAGE_UPDATE_FAILED", "Could not save coverage")
		return
	}
	if err = recordActivity(a.db, r, 0, id, "COVERAGE_UPDATED", "Coverage updated", "Patient coverage and policy limits updated"); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_LOG_FAILED", "Coverage was updated but the activity log could not be written")
		return
	}
	response.Message(w, http.StatusOK, "Coverage updated")
}
