package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/middleware"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func decodeJSON(w http.ResponseWriter, r *http.Request, target interface{}) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return false
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must contain a single JSON value")
		return false
	}
	return true
}

func actor(r *http.Request) (string, string) {
	if p, ok := middleware.PrincipalFrom(r.Context()); ok {
		return p.Name, p.Role
	}
	return "System", "SYSTEM"
}

func recordActivity(db *pgxpool.Pool, r *http.Request, caseID, patientID int64, eventType, title, description string) error {
	name, role := actor(r)
	_, err := db.Exec(r.Context(), `
		INSERT INTO activity_logs(case_id,patient_id,actor_name,actor_role,event_type,title,description)
		VALUES(NULLIF($1,0),NULLIF($2,0),$3,$4,$5,$6,$7)`,
		caseID, patientID, name, role, eventType, title, description)
	return err
}

func parsePositiveID(value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id < 1 {
		return 0, pgx.ErrNoRows
	}
	return id, nil
}

func extractInt64(val interface{}) int64 {
	switch v := val.(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	case json.Number:
		n, _ := v.Int64()
		return n
	case string:
		n, _ := strconv.ParseInt(v, 10, 64)
		return n
	default:
		return 0
	}
}
