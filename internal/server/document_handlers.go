package server

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"github.com/jackc/pgx/v5"
)

type uploadedFile struct {
	FileName string `json:"file_name"`
	FileURL  string `json:"file_url"`
	FileSize int64  `json:"file_size"`
	MimeType string `json:"mime_type"`
}

func (a *App) uploadDocument(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, (10<<20)+1<<20)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_FILE", "Upload must be a valid multipart request with a file no larger than 10 MB")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_FILE", "A file field is required")
		return
	}
	defer file.Close()
	if header.Size > 10<<20 {
		response.Fail(w, http.StatusBadRequest, "INVALID_FILE", "Files larger than 10 MB are not allowed")
		return
	}
	extension := strings.ToLower(filepath.Ext(header.Filename))
	if extension != ".pdf" && extension != ".jpg" && extension != ".jpeg" && extension != ".png" {
		response.Fail(w, http.StatusBadRequest, "INVALID_FILE", "Only PDF, JPG and PNG files are allowed")
		return
	}
	buffer := make([]byte, 512)
	n, readErr := file.Read(buffer)
	if readErr != nil && readErr != io.EOF {
		response.Fail(w, http.StatusBadRequest, "INVALID_FILE", "Could not read uploaded file")
		return
	}
	detected := http.DetectContentType(buffer[:n])
	if extension == ".pdf" && detected != "application/pdf" ||
		(extension == ".jpg" || extension == ".jpeg") && detected != "image/jpeg" ||
		extension == ".png" && detected != "image/png" {
		response.Fail(w, http.StatusBadRequest, "INVALID_FILE", "File content does not match its extension")
		return
	}
	if _, err = file.Seek(0, io.SeekStart); err != nil {
		response.Fail(w, http.StatusInternalServerError, "UPLOAD_FAILED", "Could not process uploaded file")
		return
	}
	var identifier [16]byte
	if _, err = rand.Read(identifier[:]); err != nil {
		response.Fail(w, http.StatusInternalServerError, "UPLOAD_FAILED", "Could not create file identifier")
		return
	}
	baseName := filepath.Base(header.Filename)
	baseName = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '.' || r == '-' || r == '_' {
			return r
		}
		return '_'
	}, baseName)
	now := time.Now().UTC()
	relative := filepath.Join(now.Format("2006"), now.Format("01"), hex.EncodeToString(identifier[:])+"_"+baseName)
	target := filepath.Join(uploadDir(), relative)
	if err = os.MkdirAll(filepath.Dir(target), 0750); err != nil {
		response.Fail(w, http.StatusInternalServerError, "UPLOAD_FAILED", "Could not prepare file storage")
		return
	}
	output, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0640)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "UPLOAD_FAILED", "Could not save uploaded file")
		return
	}
	size, copyErr := io.Copy(output, file)
	closeErr := output.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(target)
		response.Fail(w, http.StatusInternalServerError, "UPLOAD_FAILED", "Could not save uploaded file")
		return
	}
	mediaType := mime.TypeByExtension(extension)
	result := uploadedFile{
		FileName: header.Filename,
		FileURL:  "/uploads/" + filepath.ToSlash(relative),
		FileSize: size,
		MimeType: mediaType,
	}
	response.Created(w, result)
}

type attachedDocument struct {
	DocType             string `json:"doc_type"`
	TargetPayer         string `json:"target_payer"`
	FileName            string `json:"file_name"`
	FileURL             string `json:"file_url"`
	FileSize            int64  `json:"file_size"`
	MimeType            string `json:"mime_type"`
	IsMandatory         *bool  `json:"is_mandatory"`
	IsCriticalDischarge bool   `json:"is_critical_discharge"`
}

func (a *App) attachDocument(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	var input struct {
		Documents []attachedDocument `json:"documents"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if len(input.Documents) == 0 {
		response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "At least one document is required")
		return
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "DOCUMENT_SAVE_FAILED", "Could not save documents")
		return
	}
	defer tx.Rollback(r.Context())
	var patientID int64
	if err = tx.QueryRow(r.Context(), `SELECT patient_id FROM medical_cases WHERE id=$1`, id).Scan(&patientID); err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CASE_NOT_FOUND", "Case was not found")
		return
	} else if err != nil {
		response.Fail(w, http.StatusInternalServerError, "DOCUMENT_SAVE_FAILED", "Could not load case")
		return
	}
	for _, doc := range input.Documents {
		if doc.DocType == "" || doc.FileName == "" || doc.FileURL == "" ||
			(doc.TargetPayer != "BPJS" && doc.TargetPayer != "PRIVATE_INSURANCE" && doc.TargetPayer != "GENERAL") ||
			!strings.HasPrefix(doc.FileURL, "/uploads/") {
			response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Document metadata is invalid",
				response.FieldDetail{Field: "documents", Message: "Each document needs a type, valid target payer, file name, and /uploads/ URL"})
			return
		}
		mandatory := false
		if doc.IsMandatory != nil {
			mandatory = *doc.IsMandatory
		}
		tag, execErr := tx.Exec(r.Context(), `
			UPDATE case_documents SET file_name=$3,file_url=$4,file_size=$5,mime_type=$6,validation_status='VALID',
				is_critical_discharge=$7
			WHERE id=(SELECT id FROM case_documents WHERE case_id=$1 AND target_payer=$2 AND doc_type=$8 AND file_url='' ORDER BY id LIMIT 1)`,
			id, doc.TargetPayer, doc.FileName, doc.FileURL, doc.FileSize, doc.MimeType, doc.IsCriticalDischarge, doc.DocType)
		if execErr != nil {
			response.Fail(w, http.StatusInternalServerError, "DOCUMENT_SAVE_FAILED", "Could not update document checklist")
			return
		}
		if tag.RowsAffected() == 0 {
			_, execErr = tx.Exec(r.Context(), `
				INSERT INTO case_documents(case_id,patient_id,target_payer,doc_type,file_name,file_url,file_size,mime_type,is_mandatory,is_critical_discharge,validation_status)
				VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'VALID')`,
				id, patientID, doc.TargetPayer, doc.DocType, doc.FileName, doc.FileURL, doc.FileSize, doc.MimeType, mandatory, doc.IsCriticalDischarge)
			if execErr != nil {
				response.Fail(w, http.StatusInternalServerError, "DOCUMENT_SAVE_FAILED", "Could not save document")
				return
			}
		}
	}
	var missing int
	if err = tx.QueryRow(r.Context(), `SELECT COUNT(*) FROM case_documents WHERE case_id=$1 AND is_mandatory AND validation_status<>'VALID'`, id).Scan(&missing); err != nil {
		response.Fail(w, http.StatusInternalServerError, "DOCUMENT_SAVE_FAILED", "Could not verify document completeness")
		return
	}
	if missing == 0 {
		if _, err = tx.Exec(r.Context(), `UPDATE medical_cases SET workflow_step=GREATEST(workflow_step,2) WHERE id=$1`, id); err != nil {
			response.Fail(w, http.StatusInternalServerError, "DOCUMENT_SAVE_FAILED", "Could not update case workflow")
			return
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "DOCUMENT_SAVE_FAILED", "Could not save documents")
		return
	}
	if err = recordActivity(a.db, r, id, patientID, "DOCUMENT_UPLOADED", "Claim document uploaded", fmt.Sprintf("%d document(s) attached", len(input.Documents))); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACTIVITY_LOG_FAILED", "Documents were saved but the activity log could not be written")
		return
	}
	response.Message(w, http.StatusCreated, "Documents saved")
}

func (a *App) listCaseDocuments(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	var result []byte
	err = a.db.QueryRow(r.Context(), `
		SELECT jsonb_build_object(
			'documents',COALESCE((SELECT jsonb_agg(to_jsonb(d)-'case_id' ORDER BY d.id) FROM case_documents d WHERE d.case_id=$1),'[]'::jsonb),
			'missing_documents',COALESCE((SELECT jsonb_agg(jsonb_build_object('target_payer',d.target_payer,'doc_type',d.doc_type))
				FROM case_documents d WHERE d.case_id=$1 AND d.is_mandatory AND d.validation_status<>'VALID'),'[]'::jsonb),
			'completeness',COALESCE((SELECT jsonb_object_agg(target_payer,jsonb_build_object('required',required,'valid',valid))
				FROM (SELECT target_payer,COUNT(*) FILTER(WHERE is_mandatory) AS required,COUNT(*) FILTER(WHERE is_mandatory AND validation_status='VALID') AS valid
					FROM case_documents WHERE case_id=$1 GROUP BY target_payer) totals),'{}'::jsonb)
		)::text WHERE EXISTS(SELECT 1 FROM medical_cases WHERE id=$1)`, id).Scan(&result)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "CASE_NOT_FOUND", "Case was not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "DOCUMENT_QUERY_FAILED", "Could not load case documents")
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": json.RawMessage(result)})
}

func (a *App) deleteCaseDocument(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Case ID must be a positive integer")
		return
	}
	docID, err := pathID(r, "docId")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_ID", "Document ID must be a positive integer")
		return
	}
	var fileURL string
	err = a.db.QueryRow(r.Context(), `DELETE FROM case_documents WHERE id=$1 AND case_id=$2 RETURNING file_url`, docID, id).Scan(&fileURL)
	if err == pgx.ErrNoRows {
		response.Fail(w, http.StatusNotFound, "DOCUMENT_NOT_FOUND", "Document was not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "DOCUMENT_DELETE_FAILED", "Could not delete document")
		return
	}
	if strings.HasPrefix(fileURL, "/uploads/") {
		relative := filepath.Clean(strings.TrimPrefix(fileURL, "/uploads/"))
		if relative != "." && !strings.HasPrefix(relative, "..") && !filepath.IsAbs(relative) {
			if removeErr := os.Remove(filepath.Join(uploadDir(), relative)); removeErr != nil && !os.IsNotExist(removeErr) {
				response.Fail(w, http.StatusInternalServerError, "DOCUMENT_FILE_DELETE_FAILED", "Document metadata was deleted but the stored file could not be removed")
				return
			}
		}
	}
	response.Message(w, http.StatusOK, "Document deleted")
}
