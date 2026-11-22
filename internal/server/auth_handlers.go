package server

import (
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/middleware"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"golang.org/x/crypto/bcrypt"
)

func (a *App) login(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	var user struct {
		ID       int64
		Email    string
		Hash     string
		Name     string
		Title    string
		Role     string
		Hospital string
	}
	err := a.db.QueryRow(r.Context(), `
		SELECT id,email,password_hash,full_name,role_title,role,hospital_name
		FROM users WHERE email=$1 AND is_active=TRUE`, strings.TrimSpace(input.Email)).
		Scan(&user.ID, &user.Email, &user.Hash, &user.Name, &user.Title, &user.Role, &user.Hospital)
	if err != nil && err != pgx.ErrNoRows {
		response.Fail(w, http.StatusInternalServerError, "LOGIN_FAILED", "Could not verify credentials")
		return
	}
	if err == pgx.ErrNoRows || bcrypt.CompareHashAndPassword([]byte(user.Hash), []byte(input.Password)) != nil {
		response.Fail(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Email or password is incorrect")
		return
	}
	token, err := middleware.SignToken(user.ID, user.Email, user.Name, user.Role)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "TOKEN_CREATION_FAILED", "Could not create access token")
		return
	}
	var mode string
	if err = a.db.QueryRow(r.Context(), `SELECT value FROM system_configs WHERE key='simulation_mode'`).Scan(&mode); err != nil {
		response.Fail(w, http.StatusInternalServerError, "CONFIG_READ_FAILED", "Could not read simulation mode")
		return
	}
	response.OK(w, map[string]interface{}{
		"access_token": token,
		"user": map[string]interface{}{
			"id": user.ID, "email": user.Email, "full_name": user.Name,
			"role_title": user.Title, "role": user.Role, "hospital_name": user.Hospital,
		},
		"simulation_mode": mode,
	})
}

func (a *App) payerLogin(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	var id int64
	var email, hash, name, title, role, organization string
	var authority int64
	var err error
	if a.service == "bpjs" {
		err = a.db.QueryRow(r.Context(), `
			SELECT id,email,password_hash,full_name,role_title,branch_name
			FROM bpjs_users WHERE email=$1`, strings.TrimSpace(input.Email)).
			Scan(&id, &email, &hash, &name, &title, &organization)
		role = "REVIEWER_BPJS"
	} else {
		err = a.db.QueryRow(r.Context(), `
			SELECT id,email,password_hash,full_name,role_title,insurer_entity_name,authority_limit
			FROM insurer_users WHERE email=$1`, strings.TrimSpace(input.Email)).
			Scan(&id, &email, &hash, &name, &title, &organization, &authority)
		role = "REVIEWER_SWASTA"
	}
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(input.Password)) != nil {
		if err != nil && err != pgx.ErrNoRows {
			response.Fail(w, http.StatusInternalServerError, "LOGIN_FAILED", "Could not verify credentials")
			return
		}
		response.Fail(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Email or password is incorrect")
		return
	}
	token, err := middleware.SignToken(id, email, name, role)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "TOKEN_CREATION_FAILED", "Could not create access token")
		return
	}
	data := map[string]interface{}{
		"access_token": token,
		"user":         map[string]interface{}{"id": id, "email": email, "full_name": name, "role_title": title, "role": role, "organization": organization},
	}
	if a.service == "insurer" {
		data["user"].(map[string]interface{})["authority_limit"] = authority
	}
	response.OK(w, data)
}

func (a *App) me(w http.ResponseWriter, r *http.Request) {
	p, _ := middleware.PrincipalFrom(r.Context())
	var data map[string]interface{}
	err := a.db.QueryRow(r.Context(), `
		SELECT jsonb_build_object('id',id,'email',email,'full_name',full_name,'role_title',role_title,'role',role,'hospital_name',hospital_name)
		FROM users WHERE id=$1`, p.UserID).Scan(&data)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "USER_NOT_FOUND", "Authenticated user no longer exists")
		return
	}
	response.OK(w, data)
}

func (a *App) payerMe(w http.ResponseWriter, r *http.Request) {
	p, _ := middleware.PrincipalFrom(r.Context())
	var data map[string]interface{}
	var err error
	if a.service == "bpjs" {
		err = a.db.QueryRow(r.Context(), `
			SELECT jsonb_build_object('id',id,'email',email,'full_name',full_name,'role_title',role_title,'branch_name',branch_name)
			FROM bpjs_users WHERE id=$1`, p.UserID).Scan(&data)
	} else {
		err = a.db.QueryRow(r.Context(), `
			SELECT jsonb_build_object('id',id,'email',email,'full_name',full_name,'role_title',role_title,'insurer_entity_name',insurer_entity_name,'authority_limit',authority_limit)
			FROM insurer_users WHERE id=$1`, p.UserID).Scan(&data)
	}
	if err != nil {
		response.Fail(w, http.StatusNotFound, "USER_NOT_FOUND", "Authenticated user no longer exists")
		return
	}
	response.OK(w, data)
}

func (a *App) getConfig(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `SELECT key,value FROM system_configs ORDER BY key`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CONFIG_READ_FAILED", "Could not read system configuration")
		return
	}
	defer rows.Close()
	config := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err = rows.Scan(&key, &value); err != nil {
			response.Fail(w, http.StatusInternalServerError, "CONFIG_READ_FAILED", "Could not read system configuration")
			return
		}
		config[key] = value
	}
	if err = rows.Err(); err != nil {
		response.Fail(w, http.StatusInternalServerError, "CONFIG_READ_FAILED", "Could not read system configuration")
		return
	}
	response.OK(w, config)
}

func (a *App) patchSimulationMode(w http.ResponseWriter, r *http.Request) {
	var input struct {
		SimulationMode     string `json:"simulation_mode"`
		DefaultSplitPreset string `json:"default_split_preset"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if input.SimulationMode != "COB" && input.SimulationMode != "NON_COB" {
		response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "simulation_mode must be COB or NON_COB",
			response.FieldDetail{Field: "simulation_mode", Message: "Use COB or NON_COB"})
		return
	}
	if input.DefaultSplitPreset == "" {
		input.DefaultSplitPreset = "ARBITRARY_COB_30_58_12"
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CONFIG_UPDATE_FAILED", "Could not update system configuration")
		return
	}
	defer tx.Rollback(r.Context())
	_, err = tx.Exec(r.Context(), `UPDATE system_configs SET value=$1,updated_at=NOW() WHERE key='simulation_mode'`, input.SimulationMode)
	if err == nil {
		_, err = tx.Exec(r.Context(), `UPDATE system_configs SET value=$1,updated_at=NOW() WHERE key='default_split_preset'`, input.DefaultSplitPreset)
	}
	if err == nil {
		err = tx.Commit(r.Context())
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CONFIG_UPDATE_FAILED", "Could not update system configuration")
		return
	}
	response.OK(w, map[string]string{"simulation_mode": input.SimulationMode, "default_split_preset": input.DefaultSplitPreset})
}

func (a *App) logout(w http.ResponseWriter, r *http.Request) {
	response.Message(w, http.StatusOK, "Logged out; discard the access token on the client")
}
