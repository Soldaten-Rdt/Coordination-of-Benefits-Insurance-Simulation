package response

import (
	"encoding/json"
	"net/http"
)

type Envelope struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
	Message string      `json:"message,omitempty"`
	Error   *Error      `json:"error,omitempty"`
}

type Error struct {
	Code    string        `json:"code"`
	Message string        `json:"message"`
	Details []FieldDetail `json:"details,omitempty"`
}

type FieldDetail struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func JSON(w http.ResponseWriter, status int, value interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		return
	}
}

func OK(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusOK, Envelope{Success: true, Data: data})
}

func Created(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusCreated, Envelope{Success: true, Data: data})
}

func List(w http.ResponseWriter, data interface{}, page, limit, total int) {
	JSON(w, http.StatusOK, Envelope{Success: true, Data: data, Meta: map[string]int{
		"page": page, "limit": limit, "total": total,
	}})
}

func Message(w http.ResponseWriter, status int, message string) {
	JSON(w, status, Envelope{Success: true, Message: message})
}

func Fail(w http.ResponseWriter, status int, code, message string, details ...FieldDetail) {
	JSON(w, status, Envelope{Success: false, Error: &Error{
		Code: code, Message: message, Details: details,
	}})
}
