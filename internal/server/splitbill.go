package server

import (
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"net/http"
	"sort"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"github.com/jackc/pgx/v5"
)

type splitInput struct {
	PresetName          string  `json:"preset_name"`
	SplitMethod         string  `json:"split_method"`
	BPJSPercent         float64 `json:"bpjs_percent"`
	InsurerPercent      float64 `json:"insurer_percent"`
	PatientPercent      float64 `json:"patient_percent"`
	CustomBPJSAmount    *int64  `json:"custom_bpjs_amount"`
	CustomInsurerAmount *int64  `json:"custom_insurer_amount"`
	CustomPatientAmount *int64  `json:"custom_patient_amount"`
}

type splitResult struct {
	PresetName       string  `json:"preset_name"`
	SplitMethod      string  `json:"split_method"`
	BPJSPercent      float64 `json:"bpjs_percent"`
	InsurerPercent   float64 `json:"insurer_percent"`
	PatientPercent   float64 `json:"patient_percent"`
	TotalBill        int64   `json:"total_bill"`
	ReferenceTariff  int64   `json:"reference_tariff"`
	BPJSEstimated    int64   `json:"bpjs_estimated"`
	InsurerEstimated int64   `json:"insurer_estimated"`
	PatientEstimated int64   `json:"patient_estimated"`
}

func calculateSplit(mode string, total, tariff int64, input splitInput) (splitResult, error) {
	result := splitResult{
		PresetName: input.PresetName, SplitMethod: input.SplitMethod,
		TotalBill: total, ReferenceTariff: tariff,
	}
	if result.SplitMethod == "" {
		result.SplitMethod = "PERCENTAGE"
	}
	if result.SplitMethod != "PERCENTAGE" && result.SplitMethod != "NOMINAL" {
		return result, fmt.Errorf("split_method must be PERCENTAGE or NOMINAL")
	}
	if total < 0 {
		return result, fmt.Errorf("total bill must not be negative")
	}
	if result.SplitMethod == "PERCENTAGE" {
		insurerPercent := input.InsurerPercent
		if mode == "NON_COB" {
			insurerPercent = 0
		}
		if input.BPJSPercent < 0 || insurerPercent < 0 || input.PatientPercent < 0 ||
			input.BPJSPercent > 100 || insurerPercent > 100 || input.PatientPercent > 100 ||
			input.BPJSPercent+insurerPercent+input.PatientPercent > 100.000001 {
			return result, fmt.Errorf("split percentages must be non-negative and total at most 100")
		}
		result.BPJSPercent = input.BPJSPercent
		result.InsurerPercent = insurerPercent
		result.BPJSEstimated = int64(math.Round(float64(total) * input.BPJSPercent / 100))
		result.InsurerEstimated = int64(math.Round(float64(total) * insurerPercent / 100))
		result.PatientEstimated = total - result.BPJSEstimated - result.InsurerEstimated
	} else {
		if input.CustomBPJSAmount == nil || *input.CustomBPJSAmount < 0 {
			return result, fmt.Errorf("custom_bpjs_amount is required and must be non-negative")
		}
		insurer := int64(0)
		if mode == "COB" {
			if input.CustomInsurerAmount == nil || *input.CustomInsurerAmount < 0 {
				return result, fmt.Errorf("custom_insurer_amount is required and must be non-negative in COB mode")
			}
			insurer = *input.CustomInsurerAmount
		}
		if *input.CustomBPJSAmount > total || insurer > total-*input.CustomBPJSAmount {
			return result, fmt.Errorf("payer amounts must not exceed the total hospital bill")
		}
		result.BPJSEstimated = *input.CustomBPJSAmount
		result.InsurerEstimated = insurer
		result.PatientEstimated = total - result.BPJSEstimated - insurer
		if total > 0 {
			result.BPJSPercent = round2(float64(result.BPJSEstimated) * 100 / float64(total))
			result.InsurerPercent = round2(float64(insurer) * 100 / float64(total))
		}
	}
	if total > 0 {
		result.PatientPercent = round2(float64(result.PatientEstimated) * 100 / float64(total))
	}
	return result, nil
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}

func (a *App) calculateSplitBill(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	var input splitInput
	if !decodeJSON(w, r, &input) {
		return
	}
	var mode string
	var total, tariff int64
	err = a.db.QueryRow(r.Context(), `SELECT simulation_mode,total_hospital_bill,ina_cbg_tariff FROM medical_cases WHERE id=$1`, id).Scan(&mode, &total, &tariff)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CASE_NOT_FOUND", "Case was not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_CALCULATION_FAILED", "Could not load case financial data")
		return
	}
	result, err := calculateSplit(mode, total, tariff, input)
	if err != nil {
		response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Split bill values are invalid",
			response.FieldDetail{Field: "split", Message: err.Error()})
		return
	}
	_, err = a.db.Exec(r.Context(), `
		INSERT INTO split_bill_simulations(case_id,preset_name,bpjs_percent,insurer_percent,patient_percent,total_bill,reference_tariff,
			bpjs_estimated,insurer_estimated,patient_estimated,patient_final_excess,is_applied,updated_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,FALSE,NOW())
		ON CONFLICT(case_id) DO UPDATE SET preset_name=EXCLUDED.preset_name,bpjs_percent=EXCLUDED.bpjs_percent,
			insurer_percent=EXCLUDED.insurer_percent,patient_percent=EXCLUDED.patient_percent,total_bill=EXCLUDED.total_bill,
			reference_tariff=EXCLUDED.reference_tariff,bpjs_estimated=EXCLUDED.bpjs_estimated,insurer_estimated=EXCLUDED.insurer_estimated,
			patient_estimated=EXCLUDED.patient_estimated,patient_final_excess=EXCLUDED.patient_final_excess,is_applied=FALSE,updated_at=NOW()`,
		id, result.PresetName, result.BPJSPercent, result.InsurerPercent, result.PatientPercent, total, tariff,
		result.BPJSEstimated, result.InsurerEstimated, result.PatientEstimated)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_SAVE_FAILED", "Could not save split bill calculation")
		return
	}
	if err = recordActivity(a.db, r, id, 0, "SPLIT_BILL_CALCULATED", "Split bill simulated", "A new split bill estimate was calculated"); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_LOG_FAILED", "Split bill was calculated but the activity log could not be written")
		return
	}
	response.OK(w, result)
}

func (a *App) getSplitBill(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	var result []byte
	err = a.db.QueryRow(r.Context(), `
		SELECT jsonb_build_object('simulation',to_jsonb(sb)-'case_id',
			'bill_items',COALESCE((SELECT jsonb_agg(to_jsonb(bi)-'case_id' ORDER BY bi.id) FROM case_bill_items bi WHERE bi.case_id=$1),'[]'::jsonb)
		)::text FROM split_bill_simulations sb WHERE sb.case_id=$1`, id).Scan(&result)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "SPLIT_NOT_FOUND", "No split bill simulation exists for this case")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_QUERY_FAILED", "Could not load split bill")
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": json.RawMessage(result)})
}

func (a *App) applySplitBill(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_APPLY_FAILED", "Could not apply split bill")
		return
	}
	defer tx.Rollback(r.Context())
	var mode string
	var total, bpjs, insurer int64
	var patientID int64
	err = tx.QueryRow(r.Context(), `SELECT mc.simulation_mode,mc.total_hospital_bill,mc.patient_id,sb.bpjs_estimated,sb.insurer_estimated
		FROM medical_cases mc JOIN split_bill_simulations sb ON sb.case_id=mc.id WHERE mc.id=$1 FOR UPDATE OF mc,sb`, id).
		Scan(&mode, &total, &patientID, &bpjs, &insurer)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "SPLIT_NOT_FOUND", "Calculate a split bill before applying it")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_APPLY_FAILED", "Could not load split bill")
		return
	}
	if mode == "NON_COB" {
		insurer = 0
	}
	var bpjsCoverageID int64
	var bpjsName string
	err = tx.QueryRow(r.Context(), `
		SELECT id,insurer_name FROM patient_coverages
		WHERE patient_id=$1 AND payer_type='BPJS' AND status='ACTIVE' AND (valid_until IS NULL OR valid_until>=CURRENT_DATE)
		ORDER BY payer_tier LIMIT 1`, patientID).Scan(&bpjsCoverageID, &bpjsName)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusUnprocessableEntity, "MISSING_PRIMARY_COVERAGE", "No active BPJS coverage is available")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_APPLY_FAILED", "Could not load primary coverage")
		return
	}
	bpjsCode := fmt.Sprintf("SUB-BPJS-%03d", id)
	tag, err := tx.Exec(r.Context(), `
		INSERT INTO subclaims(subclaim_code,case_id,coverage_id,payer_type,payer_name,requested_amount,status)
		VALUES($1,$2,$3,'BPJS',$4,$5,'DRAFT')
		ON CONFLICT(subclaim_code) DO UPDATE SET coverage_id=EXCLUDED.coverage_id,payer_name=EXCLUDED.payer_name,requested_amount=EXCLUDED.requested_amount
		WHERE subclaims.status='DRAFT'`,
		bpjsCode, id, bpjsCoverageID, bpjsName, bpjs)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_APPLY_FAILED", "Could not create BPJS subclaim")
		return
	}
	if tag.RowsAffected() == 0 {
		response.Fail(w, http.StatusConflict, "SUBCLAIM_ALREADY_SUBMITTED", "A non-draft BPJS subclaim cannot be overwritten")
		return
	}
	if mode == "COB" && insurer > 0 {
		var insurerCoverageID int64
		var insurerName string
		err = tx.QueryRow(r.Context(), `
			SELECT id,insurer_name FROM patient_coverages
			WHERE patient_id=$1 AND payer_type='PRIVATE_INSURANCE' AND status='ACTIVE' AND (valid_until IS NULL OR valid_until>=CURRENT_DATE)
			ORDER BY payer_tier LIMIT 1`, patientID).Scan(&insurerCoverageID, &insurerName)
		if err == pgx.ErrNoRows {
			response.Fail(w, http.StatusUnprocessableEntity, "MISSING_SECONDARY_COVERAGE", "A private policy is required for a non-zero insurer allocation")
			return
		}
		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "SPLIT_APPLY_FAILED", "Could not load secondary coverage")
			return
		}
		tag, err = tx.Exec(r.Context(), `
			INSERT INTO subclaims(subclaim_code,case_id,coverage_id,payer_type,payer_name,requested_amount,status)
			VALUES($1,$2,$3,'PRIVATE_INSURANCE',$4,$5,'DRAFT')
			ON CONFLICT(subclaim_code) DO UPDATE SET coverage_id=EXCLUDED.coverage_id,payer_name=EXCLUDED.payer_name,requested_amount=EXCLUDED.requested_amount
			WHERE subclaims.status='DRAFT'`,
			fmt.Sprintf("SUB-AST-%03d", id+1), id, insurerCoverageID, insurerName, insurer)
		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "SPLIT_APPLY_FAILED", "Could not create insurer subclaim")
			return
		}
		if tag.RowsAffected() == 0 {
			response.Fail(w, http.StatusConflict, "SUBCLAIM_ALREADY_SUBMITTED", "A non-draft insurer subclaim cannot be overwritten")
			return
		}
	} else {
		if _, err = tx.Exec(r.Context(), `DELETE FROM subclaims WHERE case_id=$1 AND payer_type='PRIVATE_INSURANCE' AND status='DRAFT'`, id); err != nil {
			response.Fail(w, http.StatusInternalServerError, "SPLIT_APPLY_FAILED", "Could not clear private insurer allocation")
			return
		}
	}
	if _, err = tx.Exec(r.Context(), `
		UPDATE split_bill_simulations SET is_applied=TRUE,insurer_estimated=$2,patient_estimated=$3,
			patient_final_excess=$3,updated_at=NOW() WHERE case_id=$1`, id, insurer, total-bpjs-insurer); err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_APPLY_FAILED", "Could not mark split bill as applied")
		return
	}
	if err = distributeBillItems(r, tx, id, total, bpjs, insurer); err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_APPLY_FAILED", "Could not allocate split bill to line items")
		return
	}
	if _, err = tx.Exec(r.Context(), `UPDATE medical_cases SET workflow_step=GREATEST(workflow_step,3) WHERE id=$1`, id); err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_APPLY_FAILED", "Could not update case workflow")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "SPLIT_APPLY_FAILED", "Could not save split bill")
		return
	}
	if err = recordActivity(a.db, r, id, patientID, "SPLIT_BILL_APPLIED", "Split bill applied", "Estimated payer allocations were applied to the case"); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_LOG_FAILED", "Split bill was applied but the activity log could not be written")
		return
	}
	response.Message(w, http.StatusOK, "Split bill applied")
}

func distributeBillItems(r *http.Request, tx pgx.Tx, caseID, total, bpjs, insurer int64) error {
	rows, err := tx.Query(r.Context(), `SELECT id,subtotal FROM case_bill_items WHERE case_id=$1 ORDER BY id`, caseID)
	if err != nil {
		return err
	}
	type item struct{ id, subtotal int64 }
	items := make([]item, 0)
	for rows.Next() {
		var current item
		if err = rows.Scan(&current.id, &current.subtotal); err != nil {
			rows.Close()
			return err
		}
		items = append(items, current)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	subtotals := make([]int64, len(items))
	var subtotalTotal int64
	for index, current := range items {
		subtotals[index] = current.subtotal
		subtotalTotal += current.subtotal
	}
	if subtotalTotal != total || (total > 0 && len(items) == 0) {
		return fmt.Errorf("bill item totals do not match case total")
	}
	bpjsShares, err := allocateByWeight(subtotals, bpjs)
	if err != nil {
		return err
	}
	remainingShares := make([]int64, len(items))
	for index := range items {
		remainingShares[index] = items[index].subtotal - bpjsShares[index]
	}
	insurerShares, err := allocateByWeight(remainingShares, insurer)
	if err != nil {
		return err
	}
	for index, current := range items {
		partBPJS, partInsurer := bpjsShares[index], insurerShares[index]
		partPatient := current.subtotal - partBPJS - partInsurer
		if _, err = tx.Exec(r.Context(), `UPDATE case_bill_items SET bpjs_portion=$2,insurer_portion=$3,patient_portion=$4 WHERE id=$1`,
			current.id, partBPJS, partInsurer, partPatient); err != nil {
			return err
		}
	}
	return nil
}

func allocateByWeight(weights []int64, amount int64) ([]int64, error) {
	shares := make([]int64, len(weights))
	var total int64
	for _, weight := range weights {
		if weight < 0 || weight > int64(^uint64(0)>>1)-total {
			return nil, fmt.Errorf("invalid bill item weights")
		}
		total += weight
	}
	if amount < 0 || amount > total {
		return nil, fmt.Errorf("allocation amount exceeds available bill items")
	}
	if amount == 0 || total == 0 {
		return shares, nil
	}
	type remainder struct {
		index int
		value *big.Int
	}
	remainders := make([]remainder, 0, len(weights))
	var allocated int64
	for index, weight := range weights {
		numerator := new(big.Int).Mul(big.NewInt(weight), big.NewInt(amount))
		quotient, remainderValue := new(big.Int), new(big.Int)
		quotient.QuoRem(numerator, big.NewInt(total), remainderValue)
		shares[index] = quotient.Int64()
		allocated += shares[index]
		remainders = append(remainders, remainder{index: index, value: remainderValue})
	}
	sort.SliceStable(remainders, func(i, j int) bool {
		return remainders[i].value.Cmp(remainders[j].value) > 0
	})
	left := amount - allocated
	for index := int64(0); index < left; index++ {
		shares[remainders[index].index]++
	}
	return shares, nil
}
