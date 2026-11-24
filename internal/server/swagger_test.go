package server

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSwaggerSpecDoesNotReturnEmptySuccessWhenMissing(t *testing.T) {
	app := &App{service: "missing-service-spec"}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("GET", "/swagger/openapi.yaml", nil)

	app.swaggerSpec(recorder, request)

	if recorder.Code != 500 {
		t.Fatalf("expected missing specification to return 500, got %d", recorder.Code)
	}
	if strings.Contains(recorder.Body.String(), "paths: {}") {
		t.Fatal("missing specification must not return a success-shaped empty OpenAPI document")
	}
}
