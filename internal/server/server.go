package server

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/internal/database"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/internal/seed"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/middleware"
	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	service string
	db      *pgxpool.Pool
	mux     *http.ServeMux
}

func New(ctx context.Context, service string) (*App, error) {
	if service != "hospital" && service != "bpjs" && service != "insurer" {
		return nil, fmt.Errorf("unsupported service %q", service)
	}
	if len(os.Getenv("JWT_SECRET")) < 32 || len(os.Getenv("KAPJ_SERVICE_KEY")) < 32 {
		return nil, fmt.Errorf("JWT_SECRET and KAPJ_SERVICE_KEY must each contain at least 32 characters")
	}
	db, err := database.Open(ctx, service)
	if err != nil {
		return nil, err
	}
	if err = seed.Run(ctx, db, service); err != nil {
		db.Close()
		return nil, fmt.Errorf("seed %s: %w", service, err)
	}
	app := &App{service: service, db: db, mux: http.NewServeMux()}
	app.routes()
	return app, nil
}

func (a *App) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "http://localhost:3001" || origin == "http://localhost:3002" || origin == "http://localhost:3003" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-KAPJ-Service-Key, X-KAPJ-Source-Node")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		a.mux.ServeHTTP(w, r)
	})
}

func (a *App) routes() {
	a.mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		if err := a.db.Ping(r.Context()); err != nil {
			response.Fail(w, http.StatusServiceUnavailable, "DATABASE_UNAVAILABLE", "Database connection is unavailable")
			return
		}
		response.OK(w, map[string]interface{}{"service": a.service, "database": "connected"})
	})
	if a.service != "hospital" {
		a.registerPayerRoutes()
		return
	}
	a.mux.HandleFunc("POST /api/auth/login", a.login)
	a.protected("POST /api/auth/logout", a.logout)
	a.protected("GET /api/me", a.me)
	a.protected("GET /api/system/config", a.getConfig)
	a.protected("PATCH /api/system/simulation-mode", a.patchSimulationMode)
	a.protected("GET /api/patients", a.listPatients)
	a.protected("GET /api/patients/summary", a.patientSummary)
	a.protected("POST /api/patients/verify-bpjs", a.verifyBPJS)
	a.protected("POST /api/patients", a.createPatient)
	a.protected("GET /api/patients/{id}", a.getPatient)
	a.protected("PATCH /api/patients/{id}", a.updatePatient)
	a.protected("PATCH /api/patients/{id}/coverages", a.updateCoverages)
	a.protected("POST /api/cases", a.createCase)
	a.protected("GET /api/cases", a.listCases)
	a.protected("GET /api/cases/{id}", a.getCase)
	a.protected("PATCH /api/cases/{id}", a.updateCase)
	a.protected("PATCH /api/cases/{id}/discharge-checklist", a.updateDischargeChecklist)
	a.protected("POST /api/documents/upload", a.uploadDocument)
	a.protected("POST /api/cases/{id}/documents", a.attachDocument)
	a.protected("GET /api/cases/{id}/documents", a.listCaseDocuments)
	a.protected("DELETE /api/cases/{id}/documents/{docId}", a.deleteCaseDocument)
	a.protected("POST /api/cases/{id}/split-bill/calculate", a.calculateSplitBill)
	a.protected("GET /api/cases/{id}/split-bill", a.getSplitBill)
	a.protected("POST /api/cases/{id}/split-bill/apply", a.applySplitBill)
	a.protected("GET /api/cases/{id}/invoice", a.getInvoice)
	a.protected("POST /api/cases/{id}/invoice/send-patient", a.sendPatientInvoice)
	a.protected("POST /api/cases/{id}/payments", a.recordPayment)
	a.protected("GET /api/payments", a.listPayments)
	a.protected("GET /api/payments/summary", a.paymentSummary)
	a.protected("GET /api/payments/bank-reconciliation", a.bankReconciliation)

	// Dev B - T-201: Subclaim Dispatcher
	a.protected("POST /api/cases/{id}/subclaims/submit", a.submitSubclaims)
	a.protected("POST /api/cases/{id}/subclaims/{subclaimId}/resubmit", a.resubmitSubclaim)

	// Dev B - T-206: Case Messages & Notifications
	a.protected("POST /api/cases/{id}/messages", a.sendCaseMessage)
	a.protected("GET /api/notifications", a.listNotifications)
	a.protected("PATCH /api/notifications/{id}/read", a.markNotificationRead)

	// Dev B - T-206: Webhooks from Payers
	a.protectedServiceKey("POST /api/webhooks/claim-response", a.hospitalReceiveClaimResponseWebhook)
	a.protectedServiceKey("POST /api/webhooks/insurer-message", a.hospitalReceiveInsurerMessageWebhook)

	// Dev B - T-304: Hospital Operations Dashboard
	a.protected("GET /api/dashboard/summary", a.hospitalDashboardSummary)
	a.protected("GET /api/dashboard/action-required", a.hospitalActionRequired)
	a.protected("GET /api/dashboard/activities", a.hospitalDashboardActivities)

	// T-402: Swagger UI & OpenAPI spec
	a.registerSwaggerRoutes()

	a.mux.Handle("GET /uploads/{path...}", middleware.RequireJWT(
		http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadDir()))),
	))
}

func (a *App) protected(pattern string, handler http.HandlerFunc) {
	a.mux.Handle(pattern, middleware.RequireJWT(handler))
}

func (a *App) protectedServiceKey(pattern string, handler http.HandlerFunc) {
	a.mux.Handle(pattern, middleware.RequireServiceKey(handler))
}

func (a *App) registerPayerRoutes() {
	a.mux.HandleFunc("POST /api/auth/login", a.payerLogin)
	a.protected("GET /api/me", a.payerMe)
	a.registerSwaggerRoutes()

	if a.service == "bpjs" {
		// Dev B - T-202: BPJS Dashboard & Claims
		a.protected("GET /api/dashboard/summary", a.bpjsDashboardSummary)
		a.protected("GET /api/claims", a.listBPJSClaims)
		a.protected("GET /api/claims/{subclaimCode}", a.getBPJSClaimDetail)
		a.protected("PATCH /api/claims/{subclaimCode}/status", a.patchBPJSClaimStatus)
		a.protected("POST /api/claims/{subclaimCode}/decide", a.decideBPJSClaim)

		// Dev B - T-203: Webhooks from Hospital
		a.protectedServiceKey("POST /api/webhooks/claims", a.bpjsReceiveClaimWebhook)
		a.protectedServiceKey("POST /api/webhooks/messages", a.bpjsReceiveMessageWebhook)
	} else if a.service == "insurer" {
		// Dev B - T-204: Insurer Dashboard & Claims
		a.protected("GET /api/dashboard/summary", a.insurerDashboardSummary)
		a.protected("GET /api/claims", a.listInsurerClaims)
		a.protected("GET /api/claims/{subclaimCode}", a.getInsurerClaimDetail)
		a.protected("PATCH /api/claims/{subclaimCode}/status", a.patchInsurerClaimStatus)
		a.protected("POST /api/claims/{subclaimCode}/adjudicate-preview", a.previewInsurerAdjudication)
		a.protected("POST /api/claims/{subclaimCode}/decide", a.decideInsurerClaim)

		// Dev B - T-205: Webhooks from Hospital
		a.protectedServiceKey("POST /api/webhooks/claims", a.insurerReceiveClaimWebhook)
		a.protectedServiceKey("POST /api/webhooks/messages", a.insurerReceiveMessageWebhook)
	}
}

func uploadDir() string {
	if dir := strings.TrimSpace(os.Getenv("UPLOAD_DIR")); dir != "" {
		return dir
	}
	return "uploads"
}

func pathID(r *http.Request, key string) (int64, error) {
	return strconv.ParseInt(r.PathValue(key), 10, 64)
}
