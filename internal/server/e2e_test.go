package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

func TestE2ECoBRevisionAndNonCoB(t *testing.T) {
	if os.Getenv("KAPJ_E2E") != "1" {
		t.Skip("set KAPJ_E2E=1 to run against the Docker Compose services")
	}

	client := &http.Client{Timeout: 15 * time.Second}
	hospitalURL := e2eBaseURL("KAPJ_HOSPITAL_URL", "http://localhost:8081")
	bpjsURL := e2eBaseURL("KAPJ_BPJS_URL", "http://localhost:8082")
	insurerURL := e2eBaseURL("KAPJ_INSURER_URL", "http://localhost:8083")

	serviceURLs := []string{hospitalURL, bpjsURL, insurerURL}
	e2eWaitForServices(t, serviceURLs)
	for _, spec := range []struct {
		serviceURL string
		route      string
	}{
		{hospitalURL, "/api/cases/{id}/subclaims/submit"},
		{bpjsURL, "/api/claims/{subclaimCode}/decide"},
		{insurerURL, "/api/claims/{subclaimCode}/adjudicate-preview"},
	} {
		e2eStatus(t, client, http.MethodGet, spec.serviceURL+"/swagger/", "", http.StatusOK)
		specBody := e2eText(t, client, spec.serviceURL+"/swagger/openapi.yaml", http.StatusOK)
		if !strings.Contains(specBody, "openapi: 3.0.3") || !strings.Contains(specBody, spec.route) {
			t.Fatalf("OpenAPI document from %s is missing expected content for %s", spec.serviceURL, spec.route)
		}
	}

	hospitalToken := e2eLogin(t, client, hospitalURL, "siti.rahmawati@rs-jantung.co.id", "KasirRS#2025")
	bpjsToken := e2eLogin(t, client, bpjsURL, "triana.mayasari@bpjs-kesehatan.go.id", "reviewerBpjs2025!")
	insurerToken := e2eLogin(t, client, insurerURL, "bambang.sudarsono@sehatsentosa.co.id", "SecurityToken@2025!")

	nonce := time.Now().UnixNano()
	cobCaseID, _ := e2eCreateCase(t, client, hospitalURL, hospitalToken, nonce, true, "COB", 125_000_000)
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/split-bill/calculate", hospitalURL, cobCaseID), hospitalToken,
		map[string]any{"split_method": "PERCENTAGE", "bpjs_percent": 30, "insurer_percent": 58, "patient_percent": 12}, http.StatusOK)
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/split-bill/apply", hospitalURL, cobCaseID), hospitalToken, map[string]any{}, http.StatusOK)
	missingDocuments := e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/subclaims/submit", hospitalURL, cobCaseID), hospitalToken, map[string]any{}, http.StatusUnprocessableEntity)
	if e2eErrorCode(t, missingDocuments) != "MISSING_REQUIRED_DOCUMENTS" {
		t.Fatalf("expected missing-document validation error, got %#v", missingDocuments)
	}
	e2eAttachRequiredDocuments(t, client, hospitalURL, hospitalToken, cobCaseID, true)
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/subclaims/submit", hospitalURL, cobCaseID), hospitalToken, map[string]any{}, http.StatusOK)

	cobSubclaims := e2eSubclaims(t, client, hospitalURL, hospitalToken, cobCaseID)
	bpjsCode, bpjsSubclaimID := e2eSubclaim(t, cobSubclaims, "BPJS")
	insurerCode, insurerSubclaimID := e2eSubclaim(t, cobSubclaims, "PRIVATE_INSURANCE")

	e2eRequest(t, client, http.MethodPost, bpjsURL+"/api/claims/"+bpjsCode+"/decide", bpjsToken,
		map[string]any{"decision": "APPROVED", "approved_amount": 37_500_000, "reviewer_notes": "E2E approved"}, http.StatusOK)
	e2eRequest(t, client, http.MethodPost, insurerURL+"/api/claims/"+insurerCode+"/decide", insurerToken,
		map[string]any{"decision": "REVISION_REQUIRED", "reviewer_notes": "E2E revision requested"}, http.StatusOK)

	revisionCase := e2eData(t, e2eRequest(t, client, http.MethodGet, fmt.Sprintf("%s/api/cases/%d", hospitalURL, cobCaseID), hospitalToken, nil, http.StatusOK))
	if revisionCase["coordination_status"] != "ACTION_REQUIRED" {
		t.Fatalf("expected revision to require hospital action, got %v", revisionCase["coordination_status"])
	}
	actionItems := e2eArray(t, e2eRequest(t, client, http.MethodGet, hospitalURL+"/api/dashboard/action-required", hospitalToken, nil, http.StatusOK))
	if !e2eHasCaseAction(actionItems, float64(cobCaseID), insurerCode) {
		t.Fatalf("revision was not present in the hospital action-required dashboard for case %d", cobCaseID)
	}
	notificationData := e2eData(t, e2eRequest(t, client, http.MethodGet, hospitalURL+"/api/notifications", hospitalToken, nil, http.StatusOK))
	notifications, ok := notificationData["notifications"].([]any)
	if !ok {
		t.Fatalf("notifications response has unexpected shape: %#v", notificationData)
	}
	notificationID := e2eFindNotification(t, notifications, insurerCode)
	e2eRequest(t, client, http.MethodPatch, fmt.Sprintf("%s/api/notifications/%d/read", hospitalURL, notificationID), hospitalToken, map[string]any{}, http.StatusOK)
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/subclaims/%d/resubmit", hospitalURL, cobCaseID, insurerSubclaimID), hospitalToken,
		map[string]any{"notes": "E2E supporting documents corrected"}, http.StatusOK)
	e2eRequest(t, client, http.MethodPost, insurerURL+"/api/claims/"+insurerCode+"/decide", insurerToken,
		map[string]any{"decision": "APPROVED", "approved_amount": 70_000_000, "non_cover_deduction": 2_500_000, "deduction_reason": "E2E non-cover", "reviewer_notes": "E2E approved after revision"}, http.StatusOK)

	finalCobCase := e2eData(t, e2eRequest(t, client, http.MethodGet, fmt.Sprintf("%s/api/cases/%d", hospitalURL, cobCaseID), hospitalToken, nil, http.StatusOK))
	if finalCobCase["workflow_step"] != float64(5) || finalCobCase["coordination_status"] != "APPROVED" {
		t.Fatalf("expected COB case reconciled at step 5, got workflow=%v status=%v", finalCobCase["workflow_step"], finalCobCase["coordination_status"])
	}
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/payments", hospitalURL, cobCaseID), hospitalToken,
		map[string]any{"payer_source": "BPJS", "subclaim_id": bpjsSubclaimID, "payment_method": "BANK_TRANSFER", "amount": 37_500_000}, http.StatusCreated)
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/payments", hospitalURL, cobCaseID), hospitalToken,
		map[string]any{"payer_source": "PRIVATE_INSURANCE", "subclaim_id": insurerSubclaimID, "payment_method": "BANK_TRANSFER", "amount": 70_000_000}, http.StatusCreated)
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/payments", hospitalURL, cobCaseID), hospitalToken,
		map[string]any{"payer_source": "PATIENT", "payment_method": "CASH", "amount": 17_500_000}, http.StatusCreated)
	paidCobCase := e2eData(t, e2eRequest(t, client, http.MethodGet, fmt.Sprintf("%s/api/cases/%d", hospitalURL, cobCaseID), hospitalToken, nil, http.StatusOK))
	if paidCobCase["payment_status"] != "PAID" || paidCobCase["workflow_step"] != float64(6) {
		t.Fatalf("expected COB case fully paid at step 6, got payment=%v workflow=%v", paidCobCase["payment_status"], paidCobCase["workflow_step"])
	}

	nonCobCaseID, _ := e2eCreateCase(t, client, hospitalURL, hospitalToken, nonce+1, false, "NON_COB", 100_000_000)
	e2eAttachRequiredDocuments(t, client, hospitalURL, hospitalToken, nonCobCaseID, false)
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/split-bill/calculate", hospitalURL, nonCobCaseID), hospitalToken,
		map[string]any{"split_method": "PERCENTAGE", "bpjs_percent": 80, "insurer_percent": 20, "patient_percent": 0}, http.StatusOK)
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/split-bill/apply", hospitalURL, nonCobCaseID), hospitalToken, map[string]any{}, http.StatusOK)
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/subclaims/submit", hospitalURL, nonCobCaseID), hospitalToken, map[string]any{}, http.StatusOK)

	nonCobSubclaims := e2eSubclaims(t, client, hospitalURL, hospitalToken, nonCobCaseID)
	if len(nonCobSubclaims) != 1 {
		t.Fatalf("expected NON_COB to create only a BPJS subclaim, got %#v", nonCobSubclaims)
	}
	nonCobCode, nonCobSubclaimID := e2eSubclaim(t, nonCobSubclaims, "BPJS")
	e2eRequest(t, client, http.MethodPost, bpjsURL+"/api/claims/"+nonCobCode+"/decide", bpjsToken,
		map[string]any{"decision": "REVISION_REQUIRED", "reviewer_notes": "E2E correction required"}, http.StatusOK)
	revisionNonCob := e2eData(t, e2eRequest(t, client, http.MethodGet, fmt.Sprintf("%s/api/cases/%d", hospitalURL, nonCobCaseID), hospitalToken, nil, http.StatusOK))
	if revisionNonCob["coordination_status"] != "ACTION_REQUIRED" {
		t.Fatalf("expected NON_COB revision to require action, got %v", revisionNonCob["coordination_status"])
	}
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/subclaims/%d/resubmit", hospitalURL, nonCobCaseID, nonCobSubclaimID), hospitalToken,
		map[string]any{"notes": "E2E corrected medical summary"}, http.StatusOK)
	e2eRequest(t, client, http.MethodPost, bpjsURL+"/api/claims/"+nonCobCode+"/decide", bpjsToken,
		map[string]any{"decision": "APPROVED", "approved_amount": 80_000_000, "reviewer_notes": "E2E approved after revision"}, http.StatusOK)
}

func e2eBaseURL(envName, fallback string) string {
	if value := strings.TrimRight(strings.TrimSpace(os.Getenv(envName)), "/"); value != "" {
		return value
	}
	return fallback
}

func e2eWaitForServices(t *testing.T, serviceURLs []string) {
	t.Helper()
	client := &http.Client{Timeout: 2 * time.Second}
	deadline := time.Now().Add(45 * time.Second)
	for time.Now().Before(deadline) {
		allReady := true
		for _, serviceURL := range serviceURLs {
			res, err := client.Get(serviceURL + "/health")
			if err != nil {
				allReady = false
				continue
			}
			_ = res.Body.Close()
			if res.StatusCode != http.StatusOK {
				allReady = false
			}
		}
		if allReady {
			return
		}
		time.Sleep(250 * time.Millisecond)
	}
	t.Fatalf("Docker Compose APIs were not healthy within 45 seconds: %s", strings.Join(serviceURLs, ", "))
}

func e2eLogin(t *testing.T, client *http.Client, baseURL, email, password string) string {
	t.Helper()
	data := e2eData(t, e2eRequest(t, client, http.MethodPost, baseURL+"/api/auth/login", "", map[string]any{
		"email": email, "password": password,
	}, http.StatusOK))
	token, ok := data["access_token"].(string)
	if !ok || token == "" {
		t.Fatal("login response did not contain an access token")
	}
	return token
}

func e2eCreateCase(t *testing.T, client *http.Client, hospitalURL, token string, nonce int64, withPrivate bool, mode string, bill int64) (int64, map[string]any) {
	t.Helper()
	identifier := fmt.Sprintf("%016d", nonce%10_000_000_000_000_000)
	if identifier[0] == '0' {
		identifier = "1" + identifier[1:]
	}
	bpjsNumber := fmt.Sprintf("%013d", nonce%10_000_000_000_000)
	body := map[string]any{
		"full_name": "E2E Test Patient " + identifier, "nik": identifier, "birth_date": "1990-01-01", "gender": "P",
		"bpjs_number": bpjsNumber, "care_class": "Kelas 1", "primary_faskes": "E2E Faskes",
	}
	if withPrivate {
		body["private_coverages"] = []map[string]any{{
			"payer_tier": "SECONDARY", "payer_type": "PRIVATE_INSURANCE", "insurer_name": "PT Asuransi E2E",
			"card_or_policy_number": "E2E-" + identifier, "plan_name": "E2E Plan",
			"annual_limit": 100_000_000, "room_daily_limit": 5_000_000, "valid_until": "2027-12-31",
		}}
	}
	patient := e2eData(t, e2eRequest(t, client, http.MethodPost, hospitalURL+"/api/patients", token, body, http.StatusCreated))
	patientID := e2eNumber(t, patient["id"])
	caseData := e2eData(t, e2eRequest(t, client, http.MethodPost, hospitalURL+"/api/cases", token, map[string]any{
		"patient_id": patientID, "care_type": "RAWAT_INAP", "room_name": "E2E Room",
		"entitled_class": "Kelas 1", "dpjp_name": "dr. E2E",
		"admission_date": time.Now().Format("2006-01-02"), "diagnosis_icd10": "I10", "diagnosis_desc": "Essential hypertension",
		"simulation_mode": mode, "bill_items": []map[string]any{{
			"category": "TINDAKAN", "description": "E2E simulated service", "unit_info": "episode",
			"unit_price": bill, "quantity": 1,
		}},
	}, http.StatusCreated))
	return int64(e2eNumber(t, caseData["id"])), caseData
}

func e2eAttachRequiredDocuments(t *testing.T, client *http.Client, hospitalURL, token string, caseID int64, withPrivate bool) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("file", "e2e.pdf")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = file.Write([]byte("%PDF-1.4\nE2E test document\n%%EOF\n")); err != nil {
		t.Fatal(err)
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(http.MethodPost, hospitalURL+"/api/documents/upload", &body)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("upload test document: %v", err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("upload test document: expected %d, got %d: %s", http.StatusCreated, res.StatusCode, raw)
	}
	var envelope map[string]any
	if err = json.Unmarshal(raw, &envelope); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}
	upload := e2eData(t, envelope)
	fileURL, ok := upload["file_url"].(string)
	if !ok || !strings.HasPrefix(fileURL, "/uploads/") {
		t.Fatalf("upload response returned invalid file URL %v", upload["file_url"])
	}
	fileName := upload["file_name"].(string)
	fileSize := e2eNumber(t, upload["file_size"])
	mimeType := upload["mime_type"].(string)

	documents := []map[string]any{
		{"doc_type": "SEP", "target_payer": "BPJS"},
		{"doc_type": "RESUME_MEDIS", "target_payer": "BPJS", "is_critical_discharge": true},
		{"doc_type": "BILLING_RINCI", "target_payer": "BPJS"},
	}
	if withPrivate {
		documents = append(documents,
			map[string]any{"doc_type": "GL_ASURANSI", "target_payer": "PRIVATE_INSURANCE"},
			map[string]any{"doc_type": "RINCIAN_BHP", "target_payer": "PRIVATE_INSURANCE"},
		)
	}
	for _, document := range documents {
		document["file_name"] = fileName
		document["file_url"] = fileURL
		document["file_size"] = fileSize
		document["mime_type"] = mimeType
	}
	e2eRequest(t, client, http.MethodPost, fmt.Sprintf("%s/api/cases/%d/documents", hospitalURL, caseID), token,
		map[string]any{"documents": documents}, http.StatusCreated)
}

func e2eSubclaims(t *testing.T, client *http.Client, hospitalURL, token string, caseID int64) []any {
	t.Helper()
	data := e2eData(t, e2eRequest(t, client, http.MethodGet, fmt.Sprintf("%s/api/cases/%d", hospitalURL, caseID), token, nil, http.StatusOK))
	subclaims, ok := data["subclaims"].([]any)
	if !ok || len(subclaims) == 0 {
		t.Fatalf("case %d did not return subclaims", caseID)
	}
	return subclaims
}

func e2eSubclaim(t *testing.T, subclaims []any, payer string) (string, int64) {
	t.Helper()
	for _, value := range subclaims {
		subclaim, ok := value.(map[string]any)
		if !ok || subclaim["payer_type"] != payer {
			continue
		}
		code, ok := subclaim["subclaim_code"].(string)
		if !ok {
			code, _ = subclaim["code"].(string)
		}
		if code == "" {
			t.Fatalf("subclaim for %s has no code: %#v", payer, subclaim)
		}
		return code, int64(e2eNumber(t, subclaim["id"]))
	}
	t.Fatalf("no subclaim found for payer %s", payer)
	return "", 0
}

func e2eRequest(t *testing.T, client *http.Client, method, url, token string, body any, expectedStatus int) map[string]any {
	t.Helper()
	var requestBody io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		requestBody = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, url, requestBody)
	if err != nil {
		t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, url, err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != expectedStatus {
		t.Fatalf("%s %s: expected %d, got %d: %s", method, url, expectedStatus, res.StatusCode, raw)
	}
	if len(raw) == 0 {
		return map[string]any{}
	}
	var result map[string]any
	if err = json.Unmarshal(raw, &result); err != nil {
		t.Fatalf("%s %s: invalid JSON response: %v: %s", method, url, err, raw)
	}
	return result
}

func e2eStatus(t *testing.T, client *http.Client, method, url, token string, expectedStatus int) {
	t.Helper()
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		t.Fatal(err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, url, err)
	}
	defer res.Body.Close()
	if res.StatusCode != expectedStatus {
		raw, _ := io.ReadAll(res.Body)
		t.Fatalf("%s %s: expected %d, got %d: %s", method, url, expectedStatus, res.StatusCode, raw)
	}
}

func e2eText(t *testing.T, client *http.Client, url string, expectedStatus int) string {
	t.Helper()
	res, err := client.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != expectedStatus {
		t.Fatalf("GET %s: expected %d, got %d: %s", url, expectedStatus, res.StatusCode, raw)
	}
	return string(raw)
}

func e2eData(t *testing.T, envelope map[string]any) map[string]any {
	t.Helper()
	data, ok := envelope["data"].(map[string]any)
	if !ok {
		t.Fatalf("response does not contain object data: %#v", envelope)
	}
	return data
}

func e2eArray(t *testing.T, envelope map[string]any) []any {
	t.Helper()
	data, ok := envelope["data"].([]any)
	if !ok {
		t.Fatalf("response does not contain array data: %#v", envelope)
	}
	return data
}

func e2eErrorCode(t *testing.T, envelope map[string]any) string {
	t.Helper()
	apiError, ok := envelope["error"].(map[string]any)
	if !ok {
		t.Fatalf("response does not contain error details: %#v", envelope)
	}
	code, _ := apiError["code"].(string)
	return code
}

func e2eHasCaseAction(items []any, caseID float64, subclaimCode string) bool {
	for _, value := range items {
		item, ok := value.(map[string]any)
		if ok && item["case_id"] == caseID && item["subclaim_code"] == subclaimCode && item["type"] == "REVISION_REQUIRED" {
			return true
		}
	}
	return false
}

func e2eFindNotification(t *testing.T, notifications []any, subclaimCode string) int64 {
	t.Helper()
	for _, value := range notifications {
		notification, ok := value.(map[string]any)
		if ok && notification["subclaim_code"] == subclaimCode {
			return int64(e2eNumber(t, notification["id"]))
		}
	}
	t.Fatalf("notification for subclaim %s was not found", subclaimCode)
	return 0
}

func e2eNumber(t *testing.T, value any) float64 {
	t.Helper()
	number, ok := value.(float64)
	if !ok {
		t.Fatalf("expected numeric value, got %T (%v)", value, value)
	}
	return number
}
