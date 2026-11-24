package server

import (
	"context"
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

// T-206: Hospital Staff Sends Message / Clarification to Payer
func (a *App) sendCaseMessage(w http.ResponseWriter, r *http.Request) {
	caseID, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}

	var input struct {
		SubclaimID *int64 `json:"subclaim_id"`
		Message    string `json:"message"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}

	input.Message = strings.TrimSpace(input.Message)
	if input.Message == "" {
		response.Fail(w, http.StatusBadRequest, "EMPTY_MESSAGE", "Message content is required")
		return
	}

	var c struct {
		CaseNumber string
		PatientID  int64
	}
	err = a.db.QueryRow(r.Context(), `SELECT case_number, patient_id FROM medical_cases WHERE id = $1`, caseID).
		Scan(&c.CaseNumber, &c.PatientID)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CASE_NOT_FOUND", "Case was not found")
		return
	}

	var sc struct {
		ID        int64
		Code      string
		PayerType string
	}

	if input.SubclaimID != nil {
		err = a.db.QueryRow(r.Context(), `
			SELECT id, subclaim_code, payer_type
			FROM subclaims WHERE id = $1 AND case_id = $2`, *input.SubclaimID, caseID).
			Scan(&sc.ID, &sc.Code, &sc.PayerType)
		if err == pgx.ErrNoRows {
			response.Fail(w, http.StatusNotFound, "SUBCLAIM_NOT_FOUND", "Subclaim not found on this case")
			return
		}
	} else {
		// Default to first subclaim
		err = a.db.QueryRow(r.Context(), `
			SELECT id, subclaim_code, payer_type
			FROM subclaims WHERE case_id = $1 ORDER BY id ASC LIMIT 1`, caseID).
			Scan(&sc.ID, &sc.Code, &sc.PayerType)
	}

	p, _ := middleware.PrincipalFrom(r.Context())
	now := time.Now().UTC()

	var subclaimIDVal *int64
	if sc.ID > 0 {
		subclaimIDVal = &sc.ID
	}

	// Record in case_communications
	var commID int64
	err = a.db.QueryRow(r.Context(), `
		INSERT INTO case_communications(case_id, subclaim_id, sender_role, sender_name, message, created_at)
		VALUES($1, $2, $3, $4, $5, $6)
		RETURNING id`,
		caseID, subclaimIDVal, p.Role, p.Name, input.Message, now).Scan(&commID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "MESSAGE_SAVE_FAILED", "Could not save message")
		return
	}

	// Dispatch to payer webhook if subclaim exists
	if sc.Code != "" {
		commMsg := contracts.CommunicationMessage{
			ResourceType: "Communication",
			ClaimID:      sc.Code,
			CaseNumber:   c.CaseNumber,
			SenderRole:   p.Role,
			SenderName:   p.Name,
			Message:      input.Message,
			SentAt:       now,
		}

		var targetURL string
		if sc.PayerType == "BPJS" {
			base := getServiceURL("BPJS_URL", "http://bpjs-api:8082")
			targetURL = httpclient.Endpoint(base, "/api/webhooks/messages")
		} else {
			base := getServiceURL("INSURER_URL", "http://insurer-api:8083")
			targetURL = httpclient.Endpoint(base, "/api/webhooks/messages")
		}

		client := httpclient.New("hospital")
		ctxTimeout, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		_ = client.PostJSON(ctxTimeout, targetURL, commMsg)
	}

	_ = recordActivity(a.db, r, caseID, c.PatientID, "MESSAGE_SENT",
		"Pesan dikirim ke penjamin", fmt.Sprintf("[%s] %s: %s", p.Role, p.Name, input.Message))

	response.Created(w, map[string]interface{}{
		"id":          commID,
		"case_id":     caseID,
		"subclaim_id": subclaimIDVal,
		"sender_name": p.Name,
		"message":     input.Message,
		"created_at":  now.Format(time.RFC3339),
	})
}

// T-206: List Notifications
func (a *App) listNotifications(w http.ResponseWriter, r *http.Request) {
	unreadOnly := r.URL.Query().Get("unread_only") == "true"

	where := "1=1"
	if unreadOnly {
		where += " AND is_read = FALSE"
	}

	var unreadCount int
	_ = a.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM notifications WHERE is_read = FALSE`).Scan(&unreadCount)

	rows, err := a.db.Query(r.Context(), `
		SELECT id, case_id, subclaim_code, source_payer, category, title, message, is_read, created_at
		FROM notifications
		WHERE `+where+`
		ORDER BY created_at DESC
		LIMIT 50`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "NOTIFICATIONS_QUERY_FAILED", "Could not load notifications")
		return
	}
	defer rows.Close()

	notifs := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id int64
		var caseID *int64
		var code, source, category, title, message string
		var isRead bool
		var createdAt time.Time
		if err = rows.Scan(&id, &caseID, &code, &source, &category, &title, &message, &isRead, &createdAt); err == nil {
			notifs = append(notifs, map[string]interface{}{
				"id":            id,
				"case_id":       caseID,
				"subclaim_code": code,
				"source_payer":  source,
				"category":      category,
				"title":         title,
				"message":       message,
				"is_read":       isRead,
				"created_at":    createdAt.Format(time.RFC3339),
			})
		}
	}

	if notifs == nil {
		notifs = []map[string]interface{}{}
	}

	if notifs == nil {
		notifs = []map[string]interface{}{}
	}

	response.OK(w, map[string]interface{}{
		"unread_count":  unreadCount,
		"notifications": notifs,
	})
}

// T-206: Mark Notification as Read
func (a *App) markNotificationRead(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Notification ID must be a positive integer")
		return
	}

	res, err := a.db.Exec(r.Context(), `UPDATE notifications SET is_read = TRUE WHERE id = $1`, id)
	if err != nil || res.RowsAffected() == 0 {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "Notification not found")
		return
	}

	response.Message(w, http.StatusOK, "Notifikasi telah ditandai dibaca")
}
