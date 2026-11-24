package server

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
)

// T-304: Hospital Operations Dashboard Summary
func (a *App) hospitalDashboardSummary(w http.ResponseWriter, r *http.Request) {
	var activeCases, needsDocs, claimsInReview, pendingPayments int
	err := a.db.QueryRow(r.Context(), `
		SELECT
			(SELECT COUNT(*) FROM medical_cases WHERE payment_status <> 'PAID'),
			(SELECT COUNT(DISTINCT case_id) FROM case_documents WHERE is_mandatory = TRUE AND validation_status <> 'VALID'),
			(SELECT COUNT(*) FROM subclaims WHERE status IN ('SUBMITTED', 'IN_REVIEW')),
			(SELECT COUNT(*) FROM medical_cases WHERE payment_status IN ('UNPAID', 'PARTIAL'))`).
		Scan(&activeCases, &needsDocs, &claimsInReview, &pendingPayments)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "DASHBOARD_QUERY_FAILED", "Could not load hospital dashboard summary")
		return
	}

	// Monthly cost allocation
	var totalBilled, bpjsPortion, insurerPortion, patientPortion int64
	_ = a.db.QueryRow(r.Context(), `
		SELECT
			COALESCE(SUM(mc.total_hospital_bill), 0),
			COALESCE(SUM(COALESCE(sbs.bpjs_approved, sbs.bpjs_estimated, 0)), 0),
			COALESCE(SUM(COALESCE(sbs.insurer_approved, sbs.insurer_estimated, 0)), 0),
			COALESCE(SUM(COALESCE(sbs.patient_final_excess, sbs.patient_estimated, 0)), 0)
		FROM medical_cases mc
		LEFT JOIN split_bill_simulations sbs ON sbs.case_id = mc.id
		WHERE mc.created_at >= date_trunc('month', current_date)`).
		Scan(&totalBilled, &bpjsPortion, &insurerPortion, &patientPortion)

	// Tab filter for recent cases
	tab := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("tab")))
	caseWhere := "1=1"
	switch tab {
	case "NEEDS_DOCUMENTS":
		caseWhere = `EXISTS (SELECT 1 FROM case_documents cd WHERE cd.case_id = mc.id AND cd.is_mandatory = TRUE AND cd.validation_status <> 'VALID')`
	case "IN_REVIEW":
		caseWhere = `mc.coordination_status IN ('IN_REVIEW', 'SUBMITTED')`
	case "READY_RECONCILE":
		caseWhere = `mc.workflow_step >= 4 AND mc.payment_status <> 'PAID' AND NOT EXISTS (SELECT 1 FROM subclaims sc WHERE sc.case_id = mc.id AND sc.status NOT IN ('APPROVED', 'REJECTED'))`
	}

	caseQuery := fmt.Sprintf(`
		SELECT mc.id, mc.case_number, p.full_name as patient_name, p.patient_code,
		       mc.care_type, mc.room_name, mc.total_hospital_bill, mc.workflow_step,
		       mc.coordination_status, mc.payment_status, mc.simulation_mode, mc.created_at
		FROM medical_cases mc
		JOIN patients p ON p.id = mc.patient_id
		WHERE %s
		ORDER BY mc.created_at DESC
		LIMIT 10`, caseWhere)

	caseRows, err := a.db.Query(r.Context(), caseQuery)
	recentCases := make([]map[string]interface{}, 0)
	if err == nil {
		for caseRows.Next() {
			var id int64
			var caseNum, patName, patCode, careType, roomName, coordStatus, payStatus, simMode string
			var totalBill int64
			var wfStep int
			var cAt time.Time
			if err = caseRows.Scan(&id, &caseNum, &patName, &patCode, &careType, &roomName, &totalBill, &wfStep, &coordStatus, &payStatus, &simMode, &cAt); err == nil {
				recentCases = append(recentCases, map[string]interface{}{
					"id":                  id,
					"case_number":         caseNum,
					"patient_name":        patName,
					"patient_code":        patCode,
					"care_type":           careType,
					"room_name":           roomName,
					"total_hospital_bill": totalBill,
					"workflow_step":       wfStep,
					"coordination_status": coordStatus,
					"payment_status":      payStatus,
					"simulation_mode":     simMode,
					"created_at":          cAt.Format(time.RFC3339),
				})
			}
		}
		caseRows.Close()
	}

	response.OK(w, map[string]interface{}{
		"kpi": map[string]interface{}{
			"total_active_cases": activeCases,
			"needs_documents":    needsDocs,
			"claims_in_review":   claimsInReview,
			"pending_payments":   pendingPayments,
		},
		"cost_allocation": map[string]interface{}{
			"total_billed":    totalBilled,
			"bpjs_portion":    bpjsPortion,
			"insurer_portion": insurerPortion,
			"patient_portion": patientPortion,
		},
		"tab":          tab,
		"recent_cases": recentCases,
	})
}

func totalCasesCount(v int) int {
	return v
}

// T-304: Action Required Priority Items (Revisi Asuransi, Dokumen Kurang, Siap Rekonsiliasi)
func (a *App) hospitalActionRequired(w http.ResponseWriter, r *http.Request) {
	items := make([]map[string]interface{}, 0)

	// 1. Revision Required subclaims (Urgency: HIGH)
	revRows, err := a.db.Query(r.Context(), `
		SELECT mc.id as case_id, mc.case_number, p.full_name as patient_name,
		       sc.id as subclaim_id, sc.subclaim_code, sc.payer_name,
		       sc.reviewer_notes, sc.last_synced_at
		FROM subclaims sc
		JOIN medical_cases mc ON mc.id = sc.case_id
		JOIN patients p ON p.id = mc.patient_id
		WHERE sc.status = 'REVISION_REQUIRED'
		ORDER BY sc.last_synced_at DESC`)
	if err == nil {
		for revRows.Next() {
			var caseID, subclaimID int64
			var caseNum, patName, scCode, payerName, revNotes string
			var lastSync *time.Time
			if err = revRows.Scan(&caseID, &caseNum, &patName, &subclaimID, &scCode, &payerName, &revNotes, &lastSync); err == nil {
				syncStr := ""
				if lastSync != nil {
					syncStr = lastSync.Format(time.RFC3339)
				}
				items = append(items, map[string]interface{}{
					"type":          "REVISION_REQUIRED",
					"badge":         "REVISI ASURANSI",
					"urgency":       "HIGH",
					"case_id":       caseID,
					"case_number":   caseNum,
					"patient_name":  patName,
					"subclaim_id":   subclaimID,
					"subclaim_code": scCode,
					"payer_name":    payerName,
					"title":         "Permintaan Revisi Dokumen dari " + payerName,
					"description":   revNotes,
					"timestamp":     syncStr,
				})
			}
		}
		revRows.Close()
	}

	// 2. Missing Mandatory Documents (Urgency: MEDIUM)
	docRows, err := a.db.Query(r.Context(), `
		SELECT mc.id as case_id, mc.case_number, p.full_name as patient_name,
		       COUNT(cd.id) as missing_count,
		       string_agg(cd.doc_type, ', ') as missing_doc_types
		FROM case_documents cd
		JOIN medical_cases mc ON mc.id = cd.case_id
		JOIN patients p ON p.id = mc.patient_id
		WHERE cd.is_mandatory = TRUE AND cd.validation_status <> 'VALID'
		GROUP BY mc.id, mc.case_number, p.full_name
		ORDER BY mc.created_at DESC`)
	if err == nil {
		for docRows.Next() {
			var caseID, count int64
			var caseNum, patName, docTypes string
			if err = docRows.Scan(&caseID, &caseNum, &patName, &count, &docTypes); err == nil {
				items = append(items, map[string]interface{}{
					"type":         "MISSING_DOCUMENTS",
					"badge":        "DOKUMEN KURANG",
					"urgency":      "MEDIUM",
					"case_id":      caseID,
					"case_number":  caseNum,
					"patient_name": patName,
					"title":        "Kelengkapan Berkas Belum Lengkap",
					"description":  docTypes + " belum diunggah atau belum divalidasi",
					"count":        count,
				})
			}
		}
		docRows.Close()
	}

	// 3. Claims Ready for Reconciliation / Payment (Urgency: MEDIUM)
	recRows, err := a.db.Query(r.Context(), `
		SELECT mc.id as case_id, mc.case_number, p.full_name as patient_name,
		       mc.total_hospital_bill,
		       COALESCE(SUM(sc.approved_amount), 0) as approved_total
		FROM medical_cases mc
		JOIN patients p ON p.id = mc.patient_id
		JOIN subclaims sc ON sc.case_id = mc.id
		WHERE mc.workflow_step >= 4 AND mc.payment_status <> 'PAID'
		GROUP BY mc.id, mc.case_number, p.full_name, mc.total_hospital_bill
		HAVING bool_and(sc.status IN ('APPROVED', 'REJECTED'))
		ORDER BY mc.created_at DESC`)
	if err == nil {
		for recRows.Next() {
			var caseID, totalBill, appTotal int64
			var caseNum, patName string
			if err = recRows.Scan(&caseID, &caseNum, &patName, &totalBill, &appTotal); err == nil {
				items = append(items, map[string]interface{}{
					"type":            "READY_RECONCILE",
					"badge":           "SIAP REKONSILIASI",
					"urgency":         "MEDIUM",
					"case_id":         caseID,
					"case_number":     caseNum,
					"patient_name":    patName,
					"title":           "Seluruh Subklaim Telah Diputuskan",
					"description":     "Total disetujui penjamin Rp " + formatRupiah(appTotal) + ". Siap untuk pencatatan pembayaran & rekonsiliasi.",
					"approved_amount": appTotal,
					"total_bill":      totalBill,
				})
			}
		}
		recRows.Close()
	}

	if items == nil {
		items = []map[string]interface{}{}
	}

	response.OK(w, items)
}

func formatRupiah(amount int64) string {
	return strconv.FormatInt(amount, 10)
}

// T-304: Hospital Operations Activities Feed
func (a *App) hospitalDashboardActivities(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `
		SELECT al.id, al.case_id, al.patient_id, al.actor_name, al.actor_role,
		       al.event_type, al.title, al.description, al.created_at,
		       COALESCE(mc.case_number, ''), COALESCE(p.full_name, '')
		FROM activity_logs al
		LEFT JOIN medical_cases mc ON mc.id = al.case_id
		LEFT JOIN patients p ON p.id = al.patient_id
		ORDER BY al.created_at DESC
		LIMIT 20`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_QUERY_FAILED", "Could not load activity feed")
		return
	}
	defer rows.Close()

	activities := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id int64
		var caseID, patID *int64
		var actor, role, evType, title, desc, caseNum, patName string
		var cAt time.Time
		if err = rows.Scan(&id, &caseID, &patID, &actor, &role, &evType, &title, &desc, &cAt, &caseNum, &patName); err == nil {
			activities = append(activities, map[string]interface{}{
				"id":           id,
				"case_id":      caseID,
				"patient_id":   patID,
				"case_number":  caseNum,
				"patient_name": patName,
				"actor_name":   actor,
				"actor_role":   role,
				"event_type":   evType,
				"title":        title,
				"description":  desc,
				"created_at":   cAt.Format(time.RFC3339),
			})
		}
	}

	if activities == nil {
		activities = []map[string]interface{}{}
	}

	response.OK(w, activities)
}
