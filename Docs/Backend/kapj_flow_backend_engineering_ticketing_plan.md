# 📄 KAPJ Flow — Backend Engineering & Ticketing Plan (Go + PostgreSQL + Docker)

> **Versi:** 1.1 | **Arsitektur:** 3 Standalone Services (Hospital Workspace, Simulator BPJS, Asuransi Swasta) | **Stack:** Golang + PostgreSQL + Docker Compose | **Tim:** 2 Backend Developer (Dev A & Dev B) | **Patokan Selesai:** Sistem siap pakai (*End-to-End Ready*) untuk integrasi Frontend Next.js + TypeScript

**Prinsip Arsitektur Utama:**

* **3 Aplikasi Independen dalam Docker:** `hospital-service`, `bpjs-service`, dan `insurer-service` masing-masing memiliki container API Golang dan database PostgreSQL terpisah dalam satu Docker network (`kapj-network`).
* **Komunikasi Antar-Aplikasi (FHIR-Inspired JSON):** Ketiga aplikasi tidak saling mengakses database secara langsung. Seluruh pertukaran data klaim, dokumen referensi, pesan klarifikasi, dan keputusan adjudikasi dilakukan melalui HTTP REST / Webhook menggunakan payload JSON terstandar yang mengadaptasi struktur resource FHIR (`Patient`, `Coverage`, `Claim`, `ClaimResponse`).
* **Simulasi Split Bill Fleksibel (Arbitrary):** Perhitungan pembagian biaya dirancang sebagai mesin simulasi perkiraan yang fleksibel (berbasis persentase arbitrary, batas plafon simulasi, atau nominal manual per penjamin) tanpa terikat kalkulasi aktuaria/regulasi yang kaku.
* **Local-First API Documentation (Tanpa Postman):** Seluruh spesifikasi kontrak API dan koleksi pengujian disimpan secara lokal di dalam repositori Git menggunakan **OpenAPI 3.0 (Swagger UI / Scalar)** serta file **`.http` (VS Code REST Client) / Bruno**—tanpa menggunakan layanan cloud pihak ketiga yang mengumpulkan data.

---

# 📋 Daftar Isi

* [Konvensi Global & Standar Teknis](#konvensi-global--standar-teknis)
* [Fase 0 — Foundation, Docker & Kontrak Antar-Service (Blocking)](#fase-0--foundation-docker--kontrak-antar-service-blocking)
* [Fase 1 — Hospital Workspace Core (Pasien, Kasus, Dokumen & Split Bill)](#fase-1--hospital-workspace-core-pasien-kasus-dokumen--split-bill)
* [Fase 2 — Portal Penjamin (Simulator BPJS & Asuransi Swasta) & Koordinasi Klaim](#fase-2--portal-penjamin-simulator-bpjs--asuransi-swasta--koordinasi-klaim)
* [Fase 3 — Settlement Keuangan, Invoice, Rekonsiliasi & Dashboard KPI](#fase-3--settlement-keuangan-invoice-rekonsiliasi--dashboard-kpi)
* [Fase 4 — Integration Testing & Frontend Handoff Verification](#fase-4--integration-testing--frontend-handoff-verification)
* [Pembagian Tugas 2 Developer (Dev A & Dev B)](#pembagian-tugas-2-developer-dev-a--dev-b)
* [Coordination Rules & Git Workflow](#coordination-rules--git-workflow)

---

# 🌐 Konvensi Global & Standar Teknis

Berlaku untuk **seluruh service dan endpoint** pada ketiga aplikasi, tidak diulang di tiap tiket.

## 1. Topologi Container & Port Mapping (Docker)

| Komponen | Nama Container | Port Host | Keterangan |
| :--- | :--- | :--- | :--- |
| **Hospital Backend (Go)** | `kapj-hospital-api` | `8081` | REST API, Swagger UI & Webhook Receiver RS |
| **Hospital Database** | `kapj-hospital-db` | `5432` | PostgreSQL (`hospital_db`) |
| **BPJS Backend (Go)** | `kapj-bpjs-api` | `8082` | REST API, Swagger UI & Claim Receiver BPJS |
| **BPJS Database** | `kapj-bpjs-db` | `5433` | PostgreSQL (`bpjs_db`) |
| **Asuransi Swasta Backend (Go)** | `kapj-insurer-api` | `8083` | REST API, Swagger UI & Claim Receiver Swasta |
| **Asuransi Swasta Database** | `kapj-insurer-db` | `5434` | PostgreSQL (`insurer_db`) |
| **Hospital Frontend (Next.js)** | `kapj-hospital-web` | `3001` | CORS Origin diizinkan di `8081` |
| **BPJS Frontend (Next.js)** | `kapj-bpjs-web` | `3002` | CORS Origin diizinkan di `8082` |
| **Asuransi Swasta Frontend (Next.js)** | `kapj-insurer-web` | `3003` | CORS Origin diizinkan di `8083` |

## 2. Standard Response Envelope

**Sukses dengan data tunggal:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Sukses dengan data list (wajib menyertakan `meta` pagination):**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142
  }
}
```

**Sukses tanpa payload data (aksi state/delete):**
```json
{
  "success": true,
  "message": "Subklaim berhasil diajukan ke penjamin"
}
```

**Error Response (terstandar untuk form validation & business error):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data pengajuan kasus belum lengkap",
    "details": [
      { "field": "diagnosis_icd10", "message": "Kode diagnosis utama wajib diisi" },
      { "field": "documents.SEP", "message": "Dokumen SEP wajib diunggah sebelum pengajuan" }
    ]
  }
}
```

## 3. Autentikasi & Otorisasi (JWT + RBAC)

* **User Auth:** Header `Authorization: Bearer <access_token>` (JWT HS256).
* **Role Terdaftar per Service:**
  * `hospital-service`: `ADMIN_BILLING_RS`, `CASEMIX_OFFICER`, `SYSTEM_ADMIN`
  * `bpjs-service`: `REVIEWER_BPJS`
  * `insurer-service`: `REVIEWER_SWASTA`
* **Inter-Service Webhook Auth:** Setiap komunikasi antar-container (`hospital` $\leftrightarrow$ `bpjs` $\leftrightarrow$ `insurer`) wajib menyertakan header `X-KAPJ-Service-Key: <shared_secret_key>` dan `X-KAPJ-Source-Node: <hospital|bpjs|insurer>`.

## 4. Audit Trail & Activity Log

* Setiap perubahan status kasus, unggah dokumen, simulasi *split bill*, pengajuan klaim, keputusan reviewer, dan pencatatan pembayaran wajib memanggil `ActivityService.Record()` agar langsung muncul pada *Linimasa Aktivitas Pasien* dan *Log Penjamin*.

## 5. Kontrak JSON Antar-Aplikasi (FHIR-Inspired DTO)

Pertukaran data antar-service menggunakan struktur JSON berikut:

1. **Outbound `ClaimBundle` (Hospital $\rightarrow$ BPJS / Asuransi Swasta):**
   Memuat `resourceType: "Claim"`, `claimId` (`SUB-BPJS-001` / `SUB-AST-002`), `caseNumber` (`KAS-2026-001`), `payerTier` (`PRIMARY` | `SECONDARY`), `simulationMode` (`COB` | `NON_COB`), objek `patient` (nama, NIK, tanggal lahir, gender), objek `coverage` (nomor kartu BPJS / nomor polis swasta, kelas rawat, plafon), objek `clinical` (kode ICD-10, kode ICD-9-CM, DPJP, ruang rawat, tanggal masuk/keluar), `financial` (billing riil RS, tarif paket referensi, nominal diajukan, rincian item tagihan, serta referensi hasil kover BPJS apabila dikirim ke penjamin sekunder), dan array `supportingDocuments` (ID dokumen, jenis, nama file, URL akses file).
2. **Inbound `ClaimResponseBundle` (BPJS / Asuransi Swasta $\rightarrow$ Hospital):**
   Memuat `resourceType: "ClaimResponse"`, `claimId`, `caseNumber`, `payerType` (`BPJS` | `PRIVATE_INSURANCE`), `decision` (`APPROVED` | `REVISION_REQUIRED` | `REJECTED`), `requestedAmount`, `approvedAmount`, `nonCoverDeduction` (nominal potongan item non-cover polis), `deductionReason`, `reviewerName`, `reviewerNotes`, `documentReviews` (status valid/revisi per dokumen), dan `decidedAt`.
3. **Bidirectional `CommunicationMessage` (Hospital $\leftrightarrow$ Penjamin):**
   Memuat `resourceType: "Communication"`, `claimId`, `caseNumber`, `senderRole`, `senderName`, `message`, dan `sentAt`.

---

# 📦 FASE 0 — Foundation, Docker & Kontrak Antar-Service (Blocking)

**⚠️ Fase ini menjadi pondasi utama sebelum pengembangan fitur bisnis paralel dimulai.**

## T-001: Multi-Service Docker Compose & Scaffolding

**Owner:** Dev A | **Service:** All Services | **Depends:** None

### Tujuan

Menyiapkan infrastruktur Docker agar ketiga aplikasi (`hospital`, `bpjs`, `insurer`) beserta masing-masing database PostgreSQL dan volume penyimpanan file berjalan terisolasi namun terhubung dalam satu jaringan internal Docker.

### File

* **Baru:** `docker-compose.yml`
* **Baru:** `.env.example`
* **Baru:** `services/hospital-service/Dockerfile` & `cmd/api/main.go`
* **Baru:** `services/bpjs-service/Dockerfile` & `cmd/api/main.go`
* **Baru:** `services/insurer-service/Dockerfile` & `cmd/api/main.go`
* **Baru:** `pkg/contracts/fhir_dto.go` (shared DTO kontrak JSON antar-service)
* **Baru:** `pkg/response/response.go` (standard response & error wrapper)

### Spesifikasi Teknis

* Konfigurasi `healthcheck` pada setiap container PostgreSQL (`pg_isready`) sebelum container Go dijalankan (`depends_on: condition: service_healthy`).
* Konfigurasi Docker volume `hospital_uploads` yang di-mount ke `/app/uploads` dan diekspos melalui static file route `/uploads/*` agar file dokumen (PDF/PNG/JPG) yang diunggah di RS dapat langsung di-preview oleh Frontend RS, Frontend BPJS, maupun Frontend Asuransi Swasta.
* Konfigurasi middleware CORS pada ketiga service Go (`AllowOrigins: http://localhost:3001, http://localhost:3002, http://localhost:3003`, `AllowHeaders: Authorization, Content-Type, X-KAPJ-Service-Key`).

### Test Cases

* [ ] Menjalankan `docker compose up --build` mengangkat seluruh container tanpa error.
* [ ] `GET http://localhost:8081/health`, `8082/health`, dan `8083/health` mengembalikan status `200 OK` beserta status koneksi DB.
* [ ] Container `kapj-hospital-api` dapat melakukan ping HTTP ke `http://bpjs-api:8082/health` dan `http://insurer-api:8083/health` via DNS internal Docker.

---

## T-002: Skema Database PostgreSQL & Auto-Migration (3 Database Terpisah)

**Owner:** Dev A | **Service:** All Databases | **Depends:** T-001

### Tujuan

Membuat migrasi SQL untuk 3 database terpisah (`hospital_db`, `bpjs_db`, `insurer_db`) agar terisolasi secara penuh sebagaimana sistem produksi antar-institusi.

### File

* **Baru:** `services/hospital-service/migrations/001_init_hospital.sql`
* **Baru:** `services/bpjs-service/migrations/001_init_bpjs.sql`
* **Baru:** `services/insurer-service/migrations/001_init_insurer.sql`

### Rancangan Tabel Utama

1. **`hospital_db`:**
   * `users` (`id`, `email`, `password_hash`, `full_name`, `role_title`, `role`, `hospital_name`, `is_active`)
   * `system_configs` (`key`, `value` — menyimpan `simulation_mode`: `COB` | `NON_COB`, `default_split_preset`: `ARBITRARY_COB_30_58_12`)
   * `patients` (`id`, `patient_code` `PAT-2026-xxx`, `nik`, `full_name`, `birth_date`, `gender`, `phone`, `email`, `address`, `emergency_contact_name`, `emergency_contact_phone`, `created_at`)
   * `patient_coverages` (`id`, `patient_id`, `payer_tier` `PRIMARY|SECONDARY|TERTIARY`, `payer_type` `BPJS|PRIVATE_INSURANCE`, `insurer_name`, `card_or_policy_number`, `care_class`, `primary_faskes`, `annual_limit`, `remaining_limit`, `room_daily_limit`, `valid_until`, `status`)
   * `medical_cases` (`id`, `case_number` `KAS-2026-xxx`, `patient_id`, `care_type` `RAWAT_INAP|RAWAT_JALAN`, `room_name`, `entitled_class`, `dpjp_name`, `admission_date`, `discharge_date`, `diagnosis_icd10`, `diagnosis_desc`, `procedure_icd9`, `procedure_desc`, `ina_cbg_code`, `ina_cbg_tariff`, `total_hospital_bill`, `simulation_mode`, `workflow_step` 1..6, `coordination_status`, `payment_status`, `created_at`)
   * `case_bill_items` (`id`, `case_id`, `category` `AKOMODASI|TINDAKAN|FARMASI|LABORATORIUM`, `description`, `unit_info`, `unit_price`, `quantity`, `subtotal`, `bpjs_portion`, `insurer_portion`, `patient_portion`, `validation_status`)
   * `subclaims` (`id`, `subclaim_code` `SUB-BPJS-xxx` / `SUB-AST-xxx`, `case_id`, `coverage_id`, `payer_type`, `payer_name`, `sep_number`, `requested_amount`, `approved_amount`, `non_cover_deduction`, `deduction_reason`, `status` `DRAFT|SUBMITTED|IN_REVIEW|REVISION_REQUIRED|APPROVED|REJECTED`, `reviewer_name`, `reviewer_notes`, `last_synced_at`)
   * `case_documents` (`id`, `case_id`, `patient_id`, `target_payer` `GENERAL|BPJS|PRIVATE_INSURANCE`, `doc_type`, `file_name`, `file_url`, `file_size`, `mime_type`, `is_mandatory`, `is_critical_discharge`, `validation_status`, `uploaded_at`)
   * `split_bill_simulations` (`id`, `case_id`, `preset_name`, `bpjs_percent`, `insurer_percent`, `patient_percent`, `total_bill`, `reference_tariff`, `bpjs_estimated`, `insurer_estimated`, `patient_estimated`, `bpjs_approved`, `insurer_approved`, `patient_final_excess`, `notes`, `is_applied`, `updated_at`)
   * `payment_transactions` (`id`, `transaction_code` `TRX-xxx`, `case_id`, `subclaim_id`, `payer_source` `BPJS|PRIVATE_INSURANCE|PATIENT`, `payer_label`, `payment_method`, `amount`, `bank_reference`, `cashier_name`, `paid_at`, `verification_status`)
   * `case_communications` (`id`, `case_id`, `subclaim_id`, `sender_role`, `sender_name`, `message`, `created_at`)
   * `activity_logs` (`id`, `case_id`, `patient_id`, `actor_name`, `actor_role`, `event_type`, `title`, `description`, `created_at`)
   * `notifications` (`id`, `case_id`, `subclaim_code`, `source_payer`, `category`, `title`, `message`, `is_read`, `created_at`)

2. **`bpjs_db`:**
   * `bpjs_users` (`id`, `email`, `password_hash`, `full_name`, `role_title`, `branch_name`)
   * `bpjs_claims` (`id`, `subclaim_code` UNIQUE, `case_number`, `hospital_name`, `patient_snapshot` JSONB, `coverage_snapshot` JSONB, `clinical_snapshot` JSONB, `financial_snapshot` JSONB, `documents_snapshot` JSONB, `sla_deadline`, `status`, `requested_amount`, `approved_amount`, `compliance_checks` JSONB, `reviewer_id`, `reviewer_notes`, `decided_at`, `created_at`)
   * `bpjs_claim_logs` (`id`, `claim_id`, `actor_name`, `action`, `notes`, `created_at`)

3. **`insurer_db`:**
   * `insurer_users` (`id`, `email`, `password_hash`, `full_name`, `role_title`, `insurer_entity_name`, `authority_limit`)
   * `insurer_claims` (`id`, `subclaim_code` UNIQUE, `case_number`, `hospital_name`, `insurer_entity_name`, `patient_snapshot` JSONB, `policy_snapshot` JSONB, `clinical_snapshot` JSONB, `cost_breakdown_snapshot` JSONB, `documents_snapshot` JSONB, `status`, `requested_amount`, `non_cover_deduction`, `deduction_reason`, `approved_amount`, `patient_excess_impact`, `reviewer_id`, `reviewer_notes`, `decided_at`, `created_at`)
   * `insurer_claim_logs` (`id`, `claim_id`, `actor_name`, `action`, `notes`, `created_at`)

### Test Cases

* [ ] Seluruh tabel terbuat otomatis pada saat startup masing-masing service Go.
* [ ] Constraint foreign key dan unique key (`case_number`, `subclaim_code`, `patient_code`) tervalidasi.

---

## T-003: Database Seeder Demo Data (Skenario Kasus Lengkap)

**Owner:** Dev A | **Service:** All Services | **Depends:** T-002

### Tujuan

Mengisi data awal (*idempotent seed*) pada ketiga database sehingga saat Frontend dibuka pertama kali, pengguna langsung dapat melihat akun preset login, daftar pasien, dan kasus simulasi aktif yang konsisten di ketiga aplikasi.

### File

* **Baru:** `services/hospital-service/internal/seed/seeder.go`
* **Baru:** `services/bpjs-service/internal/seed/seeder.go`
* **Baru:** `services/insurer-service/internal/seed/seeder.go`

### Data Seed Wajib

1. **Akun Preset Login:**
   * Hospital: `siti.rahmawati@rs-jantung.co.id` / `KasirRS#2025` (`Siti Rahmawati, S.Kep — Admin Billing RS`)
   * BPJS: `triana.mayasari@bpjs-kesehatan.go.id` / `reviewerBpjs2025!` (`dr. Triana M., Sp.A — Reviewer Medis & Administrasi`)
   * Asuransi Swasta: `bambang.sudarsono@sehatsentosa.co.id` / `SecurityToken@2025!` (`Bambang Sudarsono, S.E., AAK — Senior Claim Underwriter`)
2. **Pasien & Kasus Simulasi:**
   * Minimal 5 pasien terdaftar (`Aulia Ramadhani`, `Budi Santoso`, `Siti Rahayu`, `Ahmad Wijaya`, `Dewi Lestari`) dengan variasi kepesertaan COB Ganda dan BPJS Tunggal.
   * Kasus aktif `KAS-2026-001` (*Aulia Ramadhani*, Rawat Inap Ruang Eksekutif, Total Billing RS Rp 125.000.000, Tarif Referensi Rp 50.000.000) beserta subklaim tersinkronisasi di `bpjs_db` (`SUB-BPJS-001`) dan `insurer_db` (`SUB-AST-002`).

### Test Cases

* [ ] Restart container tidak menduplikasi data seed (`ON CONFLICT DO NOTHING`).
* [ ] Login dengan kredensial preset berhasil di ketiga service.

---

## T-004: Shared Auth Middleware, Webhook Client & Activity Logger

**Owner:** Dev A | **Service:** All Services | **Depends:** T-001

### Tujuan

Menyediakan middleware autentikasi JWT, middleware verifikasi header internal antar-service (`X-KAPJ-Service-Key`), serta HTTP client untuk mengirim JSON antar-container.

### File

* **Baru:** `pkg/middleware/jwt_auth.go`
* **Baru:** `pkg/middleware/service_auth.go`
* **Baru:** `pkg/httpclient/webhook_client.go`

### Test Cases

* [ ] Request tanpa token ke endpoint terproteksi mengembalikan `401 UNAUTHORIZED`.
* [ ] Request webhook tanpa `X-KAPJ-Service-Key` yang valid mengembalikan `403 FORBIDDEN`.

---

# 📦 FASE 1 — Hospital Workspace Core (Pasien, Kasus, Dokumen & Split Bill)

**Service:** `hospital-service` (`:8081`)

## T-101: Auth Hospital & Konfigurasi Mode Simulasi (`COB` vs `NON_COB`)

**Owner:** Dev A | **Endpoints:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`, `GET /api/system/config`, `PATCH /api/system/simulation-mode`

### Tujuan

Menangani autentikasi petugas RS (termasuk info akun preset untuk tombol *Terapkan* di UI Login) serta pengaturan mode simulasi global (`COB` atau `NON_COB`).

### Request `POST /api/auth/login`
```json
{
  "email": "siti.rahmawati@rs-jantung.co.id",
  "password": "KasirRS#2025"
}
```

### Response `POST /api/auth/login` (200)
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbG...",
    "user": {
      "id": 1,
      "email": "siti.rahmawati@rs-jantung.co.id",
      "full_name": "Siti Rahmawati, S.Kep",
      "role_title": "Admin Billing & Casemix",
      "role": "ADMIN_BILLING_RS",
      "hospital_name": "RS Jantung Nusantara"
    },
    "simulation_mode": "COB"
  }
}
```

### Request `PATCH /api/system/simulation-mode`
```json
{
  "simulation_mode": "COB",
  "default_split_preset": "ARBITRARY_COB_30_58_12"
}
```

### Test Cases

* [ ] Login valid mengembalikan token dan profil petugas RS.
* [ ] Password salah mengembalikan `401 INVALID_CREDENTIALS`.
* [ ] Toggle mode simulasi ke `NON_COB` tersimpan dan terbaca di `GET /api/system/config`.

---

## T-102: Direktori Pasien & Pencarian (`Data Pasien`)

**Owner:** Dev A | **Endpoints:** `GET /api/patients`, `GET /api/patients/summary`

### Tujuan

Menyediakan daftar pasien beserta ringkasan metrik direktori (*Total Pasien Terdaftar*, *Kasus Aktif*, *Perlu Tindak Lanjut COB*, *Menunggu Pembayaran*), filter tab status, filter penjamin, dan pencarian nama/NIK/ID pasien.

### Query Params `GET /api/patients`

* `?q=Aulia` (cari `full_name`, `nik`, atau `patient_code`)
* `?tab=ALL|ACTIVE_CASE|ACTION_REQUIRED|UNPAID`
* `?payer=ALL|BPJS|PRIVATE_INSURANCE`
* `?page=1&limit=10`

### Response `GET /api/patients` (200)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "patient_code": "PAT-2026-001",
      "full_name": "Aulia Ramadhani",
      "nik": "3171092837480001",
      "age": 34,
      "gender": "P",
      "coverages": [
        { "payer_tier": "PRIMARY", "payer_type": "BPJS", "insurer_name": "BPJS Kesehatan", "card_or_policy_number": "000182739281" },
        { "payer_tier": "SECONDARY", "payer_type": "PRIVATE_INSURANCE", "insurer_name": "Asuransi Sehat Sentosa", "card_or_policy_number": "GOLD-EXEC-889104" }
      ],
      "cob_scheme_label": "COB Ganda",
      "total_cases": 2,
      "latest_case": {
        "id": 1,
        "case_number": "KAS-2026-001",
        "care_type_label": "Rawat Inap Paviliun",
        "coordination_status": "IN_PROGRESS",
        "payment_status": "PARTIAL"
      }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 142 }
}
```

### Test Cases

* [ ] Pencarian berdasarkan NIK dan `patient_code` mengembalikan hasil akurat.
* [ ] Filter tab `UNPAID` hanya menampilkan pasien yang memiliki kasus dengan sisa tagihan belum lunas.

---

## T-103: Registrasi Pasien Baru & Simulasi Verifikasi VClaim BPJS

**Owner:** Dev A | **Endpoints:** `POST /api/patients`, `POST /api/patients/verify-bpjs`

### Tujuan

Menyimpan data pasien baru meliputi identitas demografi, kepesertaan BPJS Kesehatan (Primer), kepesertaan Asuransi Swasta Tambahan (Sekunder + opsional Tersier), serta dokumen identitas fisik (eKTP & Kartu BPJS).

### Request `POST /api/patients/verify-bpjs`
```json
{
  "bpjs_number": "0001847291038"
}
```

### Response `POST /api/patients/verify-bpjs` (200)
```json
{
  "success": true,
  "data": {
    "bpjs_number": "0001847291038",
    "is_active": true,
    "participant_type": "PBI / Non-PBI Mandiri",
    "care_class": "Kelas 1 (Satu)",
    "primary_faskes": "Puskesmas Beji Kota Depok (Kode Faskes: 0112U004)",
    "valid_until": "2026-12-31"
  }
}
```

### Request `POST /api/patients`
```json
{
  "full_name": "Dewi Sartika Dewi",
  "nik": "3271044810930002",
  "birth_date": "1993-08-10",
  "gender": "P",
  "phone": "081298457721",
  "email": "sartika.dewi@gmail.com",
  "address": "Jl. Margonda Raya No. 412, Kota Depok",
  "bpjs_coverage": {
    "bpjs_number": "0001847291038",
    "care_class": "Kelas 1",
    "primary_faskes": "Puskesmas Beji Kota Depok (Kode Faskes: 0112U004)"
  },
  "private_coverages": [
    {
      "insurer_name": "Asuransi Sehat Sentosa",
      "policy_number": "POL-99281-SENTOSA",
      "valid_until": "2027-12-31",
      "plan_name": "Gold Executive Inpatient",
      "annual_limit": 200000000,
      "room_daily_limit": 3500000
    }
  ],
  "identity_documents": [
    { "doc_type": "E_KTP", "file_name": "Scan_eKTP.pdf", "file_url": "/uploads/..." },
    { "doc_type": "KARTU_BPJS", "file_name": "Kartu_BPJS_Digital.png", "file_url": "/uploads/..." }
  ]
}
```

### Validasi

* `nik` wajib 16 digit numerik dan unik (`DUPLICATE_NIK` 409).
* `bpjs_number` wajib 13 digit numerik jika diisi.
* Generate otomatis `patient_code` berurutan (`PAT-2026-NNN`).

### Test Cases

* [ ] Registrasi pasien dengan BPJS + 1 Asuransi Swasta membuat record di `patients` dan 2 record di `patient_coverages`.
* [ ] Registrasi pasien hanya BPJS (untuk skenario Non-COB) berhasil tanpa error.
* [ ] NIK kurang dari 16 digit atau duplikat mengembalikan `400` / `409`.

---

## T-104: Profil Pasien, Kepesertaan Aktif & Riwayat Kasus

**Owner:** Dev A | **Endpoints:** `GET /api/patients/:id`, `PATCH /api/patients/:id`, `PATCH /api/patients/:id/coverages`

### Tujuan

Menyediakan seluruh data untuk halaman *Profil Pasien*: biodata terverifikasi, kartu kepesertaan penjamin primer & sekunder beserta plafon tahunan, tabel riwayat kasus perawatan dengan rasio *split-bill*, linimasa aktivitas pasien, dan ringkasan akumulasi klaim seumur hidup.

### Test Cases

* [ ] Mengembalikan `cases[]` lengkap dengan persentase distribusi BPJS, Swasta, dan Pasien.
* [ ] Update data kontak atau plafon polis tersimpan dan tercatat di log aktivitas.

---

## T-105: Pembuatan Kasus Perawatan (`Buat Kasus`) & Validasi Kelengkapan Data

**Owner:** Dev A | **Endpoints:** `POST /api/cases`, `GET /api/cases`

### Tujuan

Menangani form *Buat Kasus* baru dari pasien terpilih: memasukkan informasi episode perawatan, diagnosis ICD-10, tindakan ICD-9-CM, tarif referensi paket, rincian item tagihan RS, serta mode koordinasi (`COB` atau `NON_COB`). Mengembalikan peringatan terstruktur jika ada field wajib yang kosong.

### Request `POST /api/cases`
```json
{
  "patient_id": 1,
  "care_type": "RAWAT_INAP",
  "room_name": "Paviliun Kartika Lt. 4, Kamar 402-A",
  "entitled_class": "Eksekutif VVIP",
  "dpjp_name": "dr. Hendra Wicaksono, Sp.JP(K)",
  "admission_date": "2026-10-12",
  "discharge_date": "2026-10-16",
  "diagnosis_icd10": "I20.0",
  "diagnosis_desc": "Unstable Angina Pectoris (Acute Coronary)",
  "procedure_icd9": "00.66",
  "procedure_desc": "Percutaneous Coronary Angioplasty (PTCA / Stent)",
  "ina_cbg_code": "I-4-10-II",
  "ina_cbg_tariff": 50000000,
  "simulation_mode": "COB",
  "bill_items": [
    { "category": "AKOMODASI", "description": "Kamar Rawat Inap VVIP", "unit_info": "5 Hari", "unit_price": 3500000, "quantity": 5 },
    { "category": "TINDAKAN", "description": "Tindakan Kateterisasi Jantung (PCI + 2 Stent DES)", "unit_info": "1 Prosedur", "unit_price": 82000000, "quantity": 1 },
    { "category": "FARMASI", "description": "Farmasi, Obat Injeksi & Alkes Habis Pakai", "unit_info": "Paket", "unit_price": 18250000, "quantity": 1 },
    { "category": "LABORATORIUM", "description": "Laboratorium Patologi Klinik, Troponin & EKG Seri", "unit_info": "8 Parameter", "unit_price": 7250000, "quantity": 1 }
  ]
}
```

### Validasi & Aksi

* Jika field wajib (`patient_id`, `diagnosis_icd10`, `dpjp_name`, `admission_date`, atau `bill_items` kosong) tidak diisi, kembalikan `422 UNPROCESSABLE_ENTITY` berisi array `details` peringatan per field agar UI menampilkan alert peringatan data kosong.
* Hitung otomatis `total_hospital_bill` dari penjumlahan `bill_items`.
* Buat `case_number` unik (`KAS-2026-NNN`), set `workflow_step = 1`, dan generate daftar *required documents checklist* default berdasarkan penjamin aktif pasien (misal: SEP, Resume Medis TTD DPJP, Billing Rinci untuk BPJS; serta GL Asuransi dan Rincian BHP untuk Asuransi Swasta jika mode `COB`).

### Test Cases

* [ ] Submit kasus valid membuat `medical_cases`, `case_bill_items`, dan checklist dokumen wajib.
* [ ] Submit dengan `bill_items` kosong atau `diagnosis_icd10` kosong mengembalikan `422` dengan daftar field yang kosong.
* [ ] Jika mode `NON_COB`, sistem hanya menyiapkan jalur penjamin primer BPJS tanpa subklaim swasta.

---

## T-106: Detail Kasus, Stepper Alur CoB & Checklist Dokumen Pulang

**Owner:** Dev A | **Endpoints:** `GET /api/cases/:id`, `PATCH /api/cases/:id`, `PATCH /api/cases/:id/discharge-checklist`

### Tujuan

Menyediakan payload lengkap untuk halaman *Detail Kasus*: progress 6 tahap alur koordinasi, konteks klinis & perbandingan tarif, ringkasan finansial & proporsi bar, daftar subklaim multi-penjamin (`SUB-BPJS-xxx` & `SUB-AST-xxx`), log komunikasi penjamin, serta status checklist dokumen kritis sebelum pulang.

### Test Cases

* [ ] Mengembalikan objek lengkap sesuai struktur kartu pada halaman *Detail Kasus*.
* [ ] Perubahan checkbox *Dokumen Kritis Sebelum Pulang* tersimpan dan tercatat di activity log.

---

## T-107: Manajemen & Upload Dokumen Pendukung Klaim

**Owner:** Dev A | **Endpoints:** `POST /api/documents/upload`, `POST /api/cases/:id/documents`, `GET /api/cases/:id/documents`, `DELETE /api/cases/:id/documents/:docId`

### Tujuan

Menangani unggah file dokumen pendukung (PDF/JPG/PNG, maks 10MB), pengelompokan dokumen berdasarkan target penjamin (`BPJS`, `PRIVATE_INSURANCE`, `GENERAL`), serta pengecekan otomatis kelengkapan dokumen sebelum klaim boleh diajukan.

### Aksi

* Simpan file ke volume `/app/uploads/<year>/<month>/<uuid>_<filename>`.
* Update otomatis `workflow_step` kasus dari `1 (Kasus Dibuat)` menjadi `2 (Berkas Dokumen)` apabila seluruh dokumen wajib telah terunggah.
* Mengembalikan warning daftar dokumen yang masih kurang (`missing_documents[]`) pada response `GET /api/cases/:id/documents`.

### Test Cases

* [ ] Upload PDF/PNG berhasil dan URL file dapat diakses langsung via HTTP GET.
* [ ] File di atas 10MB atau format `.exe`/`.zip` ditolak dengan `400 INVALID_FILE`.
* [ ] Status kelengkapan dokumen per penjamin (`3 dari 3 Lengkap` vs `4 dari 5 Valid`) terhitung akurat.

---

## T-108: Split Bill Calculator Engine (Simulasi Arbitrary & Fleksibel)

**Owner:** Dev A | **Endpoints:** `POST /api/cases/:id/split-bill/calculate`, `GET /api/cases/:id/split-bill`, `POST /api/cases/:id/split-bill/apply`

### Tujuan

Mesin simulasi pembagian biaya antara **BPJS Kesehatan**, **Asuransi Swasta**, dan **Tanggungan Pasien (Co-Pay)** dengan pendekatan **simulasi arbitrary (perkiraan fleksibel)** baik untuk mode `COB` maupun `NON_COB`, sekaligus membagi alokasi ke tiap komponen biaya (*Akomodasi Kamar*, *Tindakan Medis*, *Farmasi & Alkes*, *Laboratorium*).

### Request `POST /api/cases/:id/split-bill/calculate`

Mendukung 2 cara input simulasi (**by Percentage Split** atau **by Custom Nominal Override**):

```json
{
  "preset_name": "Simulasi CoB Standar (30% BPJS / 58% Swasta / 12% Pasien)",
  "split_method": "PERCENTAGE",
  "bpjs_percent": 30.0,
  "insurer_percent": 58.0,
  "patient_percent": 12.0,
  "custom_bpjs_amount": null,
  "custom_insurer_amount": null,
  "custom_patient_amount": null
}
```

### Logika Perhitungan Simulasi (Arbitrary & Seimbang)

1. **Mode `PERCENTAGE` (Persentase Simulasi Bebas):**
   * Petugas/sistem dapat memilih preset simulasi (misal `30% / 58% / 12%`, `40% / 50% / 10%`, atau menggeser persentase bebas asalkan total persentase $\le 100\%$).
   * $\text{bpjs\_estimated} = \text{round}(\text{total\_hospital\_bill} \times \frac{\text{bpjs\_percent}}{100})$
   * $\text{insurer\_estimated} = \text{round}(\text{total\_hospital\_bill} \times \frac{\text{insurer\_percent}}{100})$ *(otomatis $0$ jika mode `NON_COB`)*
   * $\text{patient\_estimated} = \text{total\_hospital\_bill} - \text{bpjs\_estimated} - \text{insurer\_estimated}$ *(otomatis menyerap sisa pembulatan sehingga akumulasi selalu $100\%$ tepat)*
2. **Mode `NOMINAL` (Input Perkiraan Nominal Langsung):**
   * Petugas dapat langsung memasukkan perkiraan nominal `custom_bpjs_amount` dan `custom_insurer_amount` (dibatasi tidak melebihi `total_hospital_bill`), lalu sisa selisihnya otomatis dihitung sebagai `patient_estimated`.
3. **Alokasi per Komponen Tagihan (`case_bill_items`):**
   * Mendistribusikan `bpjs_portion`, `insurer_portion`, dan `patient_portion` secara proporsional ke tiap baris item tagihan (dengan penyesuaian pembulatan pada baris terakhir agar total horizontal dan vertikal seimbang $100\%$).

### Aksi `POST /api/cases/:id/split-bill/apply`

* Menyimpan hasil simulasi ke `split_bill_simulations` (`is_applied = true`).
* Membuat atau memperbarui record pada tabel `subclaims` (`SUB-BPJS-xxx` dengan `requested_amount = bpjs_estimated`, dan `SUB-AST-xxx` dengan `requested_amount = insurer_estimated`).

### Test Cases

* [ ] Input simulasi `30% / 58% / 12%` pada total tagihan Rp 125.000.000 menghasilkan BPJS Rp 37.500.000, Swasta Rp 72.500.000, dan Pasien Rp 15.000.000.
* [ ] Input nominal langsung (misal BPJS Rp 40.000.000 dan Swasta Rp 65.000.000) otomatis menetapkan sisa Rp 20.000.000 sebagai tanggungan pasien.
* [ ] Mode `NON_COB` otomatis mengunci porsi asuransi swasta menjadi `0` dan mengalokasikan sisa ke pasien.

---

# 📦 FASE 2 — Portal Penjamin (Simulator BPJS & Asuransi Swasta) & Koordinasi Klaim

**Services:** `hospital-service` (`:8081`), `bpjs-service` (`:8082`), `insurer-service` (`:8083`)

## T-201: Pengajuan Subklaim (Hospital $\rightarrow$ BPJS & Asuransi Swasta Dispatcher)

**Owner:** Dev B | **Service:** `hospital-service` | **Endpoints:** `POST /api/cases/:id/subclaims/submit`, `POST /api/cases/:id/subclaims/:subclaimId/resubmit`

### Tujuan

Mengirimkan paket pengajuan subklaim dari RS ke `bpjs-service` dan/atau `insurer-service` dalam bentuk JSON FHIR-inspired `ClaimBundle`, sekaligus memperbarui status kasus di RS.

### Validasi Sebelum Pengajuan

* Minimal simulasi *Split Bill* sudah disimpan (`is_applied = true`).
* Seluruh dokumen wajib untuk penjamin terkait sudah berstatus terunggah (`MISSING_REQUIRED_DOCUMENTS` 422 jika belum lengkap).

### Aksi

1. Generate nomor SEP simulasi (`0041R0011026V...`) untuk subklaim BPJS jika belum ada.
2. Kirim HTTP `POST http://bpjs-api:8082/api/webhooks/claims` dengan payload `ClaimBundle` BPJS.
3. Jika mode `COB` dan pasien memiliki polis swasta aktif, kirim HTTP `POST http://insurer-api:8083/api/webhooks/claims` dengan payload `ClaimBundle` Asuransi Swasta (menyertakan informasi porsi primer BPJS).
4. Update status subklaim menjadi `SUBMITTED`, update `workflow_step` kasus menjadi `4 (Review Penjamin)`, dan catat pada `activity_logs` serta `case_communications`.

### Test Cases

* [ ] Pengajuan sukses mengubah status subklaim di RS menjadi `SUBMITTED` dan data klaim langsung muncul di `bpjs-service` dan `insurer-service`.
* [ ] Jika salah satu service penjamin sedang mati, mengembalikan error terstruktur `502 PAYER_GATEWAY_UNAVAILABLE` tanpa merusak konsistensi transaksi DB.
* [ ] Endpoint `resubmit` mengirim ulang dokumen revisi dan catatan perbaikan ke penjamin yang meminta revisi.

---

## T-202: Auth & Dashboard Review Klaim — Simulator BPJS

**Owner:** Dev B | **Service:** `bpjs-service` (`:8082`) | **Endpoints:** `POST /api/auth/login`, `GET /api/me`, `GET /api/dashboard/summary`, `GET /api/claims`

### Tujuan

Menyediakan autentikasi verifikator medis JKN serta data lengkap halaman *Dashboard Review Klaim BPJS*: 5 kartu KPI (*Total Klaim Masuk*, *Menunggu Review*, *Sedang Ditinjau*, *Perlu Revisi*, *Disetujui Bulan Ini*), antrean subklaim prioritas beserta SLA timer, filter status/kategori, distribusi keputusan, faskes mitra teraktif, dan log aktivitas verifikator.

### Test Cases

* [ ] Login verifikator BPJS mengembalikan token dan profil `BPJS Cabang Utama`.
* [ ] `GET /api/claims` mendukung filter `?filter=ALL|SLA_URGENT|EXECUTIVE_INPATIENT` dan pencarian ID subklaim/pasien.

---

## T-203: Receiver Klaim & Adjudikasi Review — Simulator BPJS

**Owner:** Dev B | **Service:** `bpjs-service` (`:8082`) | **Endpoints:** `POST /api/webhooks/claims`, `POST /api/webhooks/messages`, `GET /api/claims/:subclaimCode`, `PATCH /api/claims/:subclaimCode/status`, `POST /api/claims/:subclaimCode/decide`

### Tujuan

Menerima pengajuan klaim dari RS, menampilkan detail review klinis (ICD-10, ICD-9-CM, SEP, tarif INA-CBGs, dokumen pendukung), mencatat checklist kepatuhan 4 poin, dan mengirimkan keputusan akhir kembali ke `hospital-service`.

### Request `POST /api/claims/:subclaimCode/decide`
```json
{
  "decision": "APPROVED",
  "approved_amount": 37500000,
  "compliance_checks": {
    "jkn_active": true,
    "referral_valid": true,
    "icd_coding_match": true,
    "no_duplicate_claim": true
  },
  "reviewer_notes": "Klaim sesuai indikasi medis dan regulasi Ina-CBGs Kelas 1 rawat inap. Disetujui penuh untuk batas pertanggungan primer."
}
```
*(Nilai `decision` yang didukung: `APPROVED`, `REVISION_REQUIRED`, `REJECTED`)*

### Aksi

1. Simpan keputusan di `bpjs_claims` dan catat di `bpjs_claim_logs`.
2. Kirim callback HTTP `POST http://hospital-api:8081/api/webhooks/claim-response` berisi JSON `ClaimResponseBundle` (termasuk status masing-masing dokumen jika `REVISION_REQUIRED`).

### Test Cases

* [ ] Ketika reviewer BPJS menekan `Setujui Klaim` (`APPROVED`), status subklaim di RS otomatis berubah menjadi `Disetujui Penuh` dengan nilai Rp 37.500.000.
* [ ] Ketika reviewer memilih `Minta Revisi Berkas` (`REVISION_REQUIRED`), status di RS berubah menjadi `Perlu Revisi` dan catatan muncul di panel *Perlu Tindak Lanjut*.

---

## T-204: Auth & Dashboard Review Klaim — Asuransi Swasta

**Owner:** Dev B | **Service:** `insurer-service` (`:8083`) | **Endpoints:** `POST /api/auth/login`, `GET /api/me`, `GET /api/dashboard/summary`, `GET /api/claims`

### Tujuan

Menyediakan autentikasi adjudikator/underwriter asuransi swasta (mendukung pilihan entitas seperti *PT Asuransi Sehat Sentosa* dan *Asuransi Nusantara*) serta data *Dashboard Review Klaim Asuransi*: 5 kartu KPI (*Klaim Masuk*, *Menunggu Review*, *Perlu Revisi/Audit*, *Disetujui Bulan Ini*, *Ekses Tertolak*), daftar klaim sekunder CoB terbaru, aturan polis & parameter CoB, dan linimasa aktivitas adjudikator.

### Test Cases

* [ ] Login underwriter swasta mengembalikan token dan batas otoritas underwriter.
* [ ] Filter klaim pada dashboard mengembalikan antrean subklaim `SUB-AST-xxx` sesuai entitas asuransi yang login.

---

## T-205: Receiver Klaim, Kalkulasi Potongan Non-Cover & Adjudikasi — Asuransi Swasta

**Owner:** Dev B | **Service:** `insurer-service` (`:8083`) | **Endpoints:** `POST /api/webhooks/claims`, `POST /api/webhooks/messages`, `GET /api/claims/:subclaimCode`, `PATCH /api/claims/:subclaimCode/status`, `POST /api/claims/:subclaimCode/adjudicate-preview`, `POST /api/claims/:subclaimCode/decide`

### Tujuan

Menerima pengajuan subklaim sekunder dari RS, memverifikasi batas manfaat polis (plafon tahunan RI, limit kamar harian, limit tindakan bedah/kateter), menghitung simulasi potongan item non-cover beserta dampaknya terhadap tambahan ekses pasien, dan mengirimkan keputusan akhir kembali ke `hospital-service`.

### Request `POST /api/claims/:subclaimCode/adjudicate-preview`
```json
{
  "non_cover_deduction": 2500000,
  "deduction_reason": "Suplemen hepar & multivitamin injeksi di luar ketentuan polis Gold Exec Bab 4 Psl 8"
}
```

### Response `POST /api/claims/:subclaimCode/adjudicate-preview` (200)
```json
{
  "success": true,
  "data": {
    "requested_amount": 72500000,
    "non_cover_deduction": 2500000,
    "recommended_approved_amount": 70000000,
    "initial_patient_excess": 15000000,
    "patient_additional_excess": 2500000,
    "final_patient_excess": 17500000,
    "coverage_percentage_of_total_bill": 56.0
  }
}
```

### Request `POST /api/claims/:subclaimCode/decide`
```json
{
  "decision": "APPROVED",
  "approved_amount": 70000000,
  "non_cover_deduction": 2500000,
  "deduction_reason": "Suplemen hepar & multivitamin injeksi di luar ketentuan polis Gold Exec Bab 4 Psl 8",
  "reviewer_notes": "Biaya stent kateterisasi disetujui sebesar Rp 70.000.000 sesuai batasan manfaat polis Gold Executive.",
  "document_statuses": [
    { "doc_type": "GL_ASURANSI", "status": "VALID" },
    { "doc_type": "RINCIAN_BHP", "status": "CLARIFICATION_NEEDED", "note": "Terdapat selisih kover 1 jenis suplemen/vitamin injeksi" }
  ]
}
```

### Aksi

* Simpan keputusan dan kirim callback HTTP `POST http://hospital-api:8081/api/webhooks/claim-response` berisi JSON `ClaimResponseBundle`.

### Test Cases

* [ ] Potongan non-cover Rp 2.500.000 dari pengajuan Rp 72.500.000 menghitung rekomendasi disetujui Rp 70.000.000 dan mengalihkan ekses pasien menjadi Rp 17.500.000.
* [ ] Callback ke `hospital-service` otomatis memperbarui angka tanggungan di halaman *Detail Kasus* dan *Invoice*.

---

## T-206: Webhook Receiver Keputusan Penjamin, Komunikasi & Notifikasi RS

**Owner:** Dev B | **Service:** `hospital-service` (`:8081`) | **Endpoints:** `POST /api/webhooks/claim-response`, `POST /api/webhooks/insurer-message`, `POST /api/cases/:id/messages`, `GET /api/notifications`, `PATCH /api/notifications/:id/read`

### Tujuan

Menangani penerimaan hasil adjudikasi dari BPJS dan Asuransi Swasta secara *idempotent*, melakukan rekonsiliasi otomatis nilai persetujuan terhadap *Split Bill* dan ekses pasien, serta mengelola komunikasi dua arah dan notifikasi RS.

### Logika Rekonsiliasi Otomatis saat Callback Diterima

1. Update status dan nominal `approved_amount` serta `non_cover_deduction` pada tabel `subclaims`.
2. Hitung ulang `patient_final_excess` pada `split_bill_simulations`:
   $$\text{patient\_final\_excess} = \text{total\_hospital\_bill} - \text{bpjs\_approved} - \text{insurer\_approved}$$
3. Jika seluruh subklaim pada kasus tersebut sudah berstatus `APPROVED` (atau selesai diputuskan), naikkan `workflow_step` kasus menjadi `5 (Rekonsiliasi Split)`.
4. Buat record baru pada tabel `notifications` (sehingga badge lonceng merah di topbar/sidebar RS bertambah) dan catat di `case_communications` serta `activity_logs`.

### Test Cases

* [ ] Callback dari BPJS (`Rp 37.500.000`) dan Swasta (`Rp 70.000.000`) memperbarui sisa tanggungan pasien menjadi `Rp 17.500.000`.
* [ ] Mengirim pesan dari RS (`POST /api/cases/:id/messages`) meneruskan pesan ke service penjamin terkait dan muncul di log kedua sisi.
* [ ] `GET /api/notifications` menampilkan daftar notifikasi belum dibaca beserta total `unread_count`.

---

# 📦 FASE 3 — Settlement Keuangan, Invoice, Rekonsiliasi & Dashboard KPI

## T-301: Detail Pembayaran & Invoice Simulasi CoB

**Owner:** Dev A | **Service:** `hospital-service` (`:8081`) | **Endpoints:** `GET /api/cases/:id/invoice`, `POST /api/cases/:id/invoice/send-patient`

### Tujuan

Menyediakan seluruh data dokumen *Invoice Simulasi / Rekap Pembagian Biaya CoB*: rincian komponen tagihan RS, alokasi beban multi-penjamin (BPJS Kesehatan, Asuransi Swasta, dan Co-Payment/Selisih Pasien), rasio persentase alokasi, ringkasan KPI atas (*Total Tagihan RS*, *Disetujui Penjamin*, *Dibayar Masuk*, *Sisa Tagihan Terbuka*), dan riwayat transaksi tercatat pada kasus tersebut.

### Response `GET /api/cases/:id/invoice` (200)
```json
{
  "success": true,
  "data": {
    "invoice_number": "SIM-INV/2026/11-0428",
    "case_number": "KAS-2026-001",
    "patient": {
      "full_name": "Aulia Ramadhani",
      "patient_code": "PAT-2026-001",
      "room_info": "Rawat Inap Paviliun Kartika (Bed 402-A)",
      "admission_date": "2026-10-08"
    },
    "summary": {
      "total_hospital_bill": 125000000,
      "total_approved_payers": 107500000,
      "total_paid_received": 5000000,
      "remaining_open_balance": 120000000
    },
    "bill_items": [ ... ],
    "allocations": [
      { "payer_source": "BPJS", "label": "BPJS Kesehatan (Penjamin Pertama)", "ratio_percent": 30.0, "amount": 37500000, "paid_amount": 0, "remaining_amount": 37500000, "status": "APPROVED" },
      { "payer_source": "PRIVATE_INSURANCE", "label": "Asuransi Sehat Sentosa (Penjamin Tambahan)", "ratio_percent": 56.0, "amount": 70000000, "paid_amount": 0, "remaining_amount": 70000000, "status": "APPROVED" },
      { "payer_source": "PATIENT", "label": "Pasien / Keluarga (Co-Payment & Selisih)", "ratio_percent": 14.0, "amount": 17500000, "paid_amount": 5000000, "remaining_amount": 12500000, "status": "UNPAID" }
    ],
    "transactions": [ ... ]
  }
}
```

### Test Cases

* [ ] Saldo `remaining_open_balance` selalu konsisten dengan `total_hospital_bill - total_paid_received`.
* [ ] Sisa per masing-masing pembayar (`BPJS`, `PRIVATE_INSURANCE`, `PATIENT`) terhitung akurat untuk mengisi nilai default pada form *Catat Transaksi Pembayaran*.

---

## T-302: Pencatatan Transaksi Pembayaran & Penyelesaian Kasus

**Owner:** Dev A | **Service:** `hospital-service` (`:8081`) | **Endpoints:** `POST /api/cases/:id/payments`

### Tujuan

Menangani form *Catat Transaksi Pembayaran* untuk merekam penerimaan dana dari BPJS Kesehatan, Asuransi Swasta, maupun deposit/pelunasan ekses pasien, serta menutup kasus menjadi `Selesai` apabila seluruh komponen tagihan telah lunas.

### Request `POST /api/cases/:id/payments`
```json
{
  "payer_source": "BPJS",
  "subclaim_id": 1,
  "paid_at": "2026-11-18T09:40:00Z",
  "payment_method": "BANK_TRANSFER",
  "amount": 37500000,
  "bank_reference": "TRF-BNI-9018237"
}
```

### Validasi & Aksi

* Nominal `amount` tidak boleh `<= 0` dan tidak boleh melebihi sisa tagihan pihak pembayar terkait (`OVERPAYMENT_NOT_ALLOWED` 400).
* Generate `transaction_code` unik (`TRX-YYYY-NNNN`).
* Update `payment_status` kasus:
  * Jika `total_paid_received == 0` $\rightarrow$ `UNPAID`
  * Jika $0 < \text{total\_paid\_received} < \text{total\_hospital\_bill}$ $\rightarrow$ `PARTIAL` (*Dibayar Sebagian*)
  * Jika $\text{total\_paid\_received} \ge \text{total\_hospital\_bill}$ $\rightarrow$ `PAID` (*Lunas*) dan naikkan `workflow_step` kasus menjadi `6 (Selesai / Discharge & Pelunasan)`.
* Catat pada `activity_logs`.

### Test Cases

* [ ] Pembayaran sebagian mengubah status kasus menjadi `PARTIAL`.
* [ ] Pelunasan seluruh porsi (BPJS + Swasta + Ekses Pasien) mengubah status kasus menjadi `PAID` dan `workflow_step = 6`.
* [ ] Input nominal melebihi sisa tagihan ditolak dengan `400 OVERPAYMENT_NOT_ALLOWED`.

---

## T-303: Halaman Pembayaran Lintas Kasus & Rekonsiliasi Finansial

**Owner:** Dev A | **Service:** `hospital-service` (`:8081`) | **Endpoints:** `GET /api/payments`, `GET /api/payments/summary`, `GET /api/payments/bank-reconciliation`

### Tujuan

Menyediakan data halaman *Pembayaran & Rekonsiliasi Finansial*: 4 kartu KPI keuangan (*Total Nilai Disetujui Penjamin*, *Pembayaran Diterima/Lunas*, *Menunggu Transfer Penjamin*, *Sisa Ekses Tanggungan Pasien*), tabel transaksi multi-kasus dengan filter status (`ALL`, `UNPAID`, `PARTIAL`, `PAID`) dan filter penjamin, serta feed pencocokan mutasi bank escrow.

### Test Cases

* [ ] Agregasi 4 kartu KPI sesuai dengan jumlah seluruh transaksi dan subklaim di database.
* [ ] Pencarian berdasarkan `case_number` atau nama pasien berfungsi dengan pagination.

---

## T-304: Dashboard Operasional RS & Tindak Lanjut Aggregator

**Owner:** Dev B | **Service:** `hospital-service` (`:8081`) | **Endpoints:** `GET /api/dashboard/summary`, `GET /api/dashboard/action-required`, `GET /api/dashboard/activities`

### Tujuan

Menyediakan seluruh data agregasi untuk halaman utama *Dashboard Operasional RS*: 4 kartu KPI (*Total Kasus Aktif*, *Dokumen Belum Lengkap*, *Klaim Menunggu Review*, *Pembayaran Tertunda*), daftar kasus perawatan terbaru dengan filter status, panel prioritas *Perlu Tindak Lanjut* (kasus yang diminta revisi asuransi, dokumen hilang, atau subklaim disetujui siap kalkulasi), aktivitas terbaru, dan grafik *Alokasi Biaya Bulan Ini*.

### Test Cases

* [ ] Ketika penjamin mengirim status `REVISION_REQUIRED`, kasus tersebut otomatis muncul di endpoint `GET /api/dashboard/action-required` dengan badge `REVISI ASURANSI`.
* [ ] Filter tab pada tabel kasus terbaru (`ALL`, `NEEDS_DOCUMENTS`, `IN_REVIEW`, `READY_RECONCILE`) mengembalikan jumlah yang cocok dengan badge tab.

---

# 📦 FASE 4 — Integration Testing & Frontend Handoff Verification

## T-401: End-to-End Integration Test Suite (Pipeline CoB & Non-CoB)

**Owner:** Both (Dev A & Dev B) | **Service:** All Services | **Depends:** Fase 1, 2, 3

### Tujuan

Memastikan seluruh skenario pengujian utama berjalan mulus lintas 3 container sebelum diserahkan kepada tim Frontend Next.js.

### Skenario Pengujian Wajib

1. **Skenario 1 — Happy Path Coordination of Benefits (CoB):**
   * Admin RS login $\rightarrow$ registrasi pasien baru dengan BPJS + Asuransi Swasta $\rightarrow$ buat kasus perawatan baru (`COB`) $\rightarrow$ unggah dokumen wajib $\rightarrow$ jalankan *Split Bill Calculator* (simulasi arbitrary) & simpan $\rightarrow$ ajukan subklaim ke BPJS & Swasta $\rightarrow$ Verifikator BPJS login & menyetujui klaim primer $\rightarrow$ Reviewer Swasta login, menghitung potongan non-cover & menyetujui klaim sekunder $\rightarrow$ RS menerima callback, mencatat pelunasan pembayaran BPJS, Swasta, & Ekses Pasien $\rightarrow$ kasus berstatus `Lunas` & `Selesai`.
2. **Skenario 2 — Alur Revisi Berkas Penjamin:**
   * Reviewer BPJS/Swasta memilih `Minta Revisi Berkas` $\rightarrow$ notifikasi & item *Perlu Tindak Lanjut* muncul di Dashboard RS $\rightarrow$ Admin RS mengunggah dokumen revisi & mengirim ulang (`resubmit`) $\rightarrow$ Penjamin menyetujui klaim.
3. **Skenario 3 — Mode Non-CoB (Penjamin Tunggal):**
   * Pembuatan kasus dengan mode `NON_COB` hanya menerbitkan subklaim BPJS tanpa meneruskan klaim ke Asuransi Swasta.
4. **Skenario 4 — Cold-Start Docker Verification:**
   * `docker compose down -v && docker compose up --build` membangun ulang seluruh database, menjalankan migrasi, mengisi data seed, dan seluruh skenario di atas lulus 100%.

---

## T-402: Kontrak OpenAPI 3.0, Embedded Swagger UI & Local REST Client (`.http` / Bruno)

**Owner:** Both (Dev A & Dev B) | **Service:** All Services | **Depends:** T-401

### Tujuan

Menyediakan dokumentasi kontrak API lengkap dan lokal di dalam repositori Git tanpa menggunakan layanan pihak ketiga berbasis cloud seperti Postman (menghindari potensi pengumpulan data training dari payload/skema internal).

### File & Artefak Handoff

* **Baru:** `docs/openapi/hospital-api.yaml` (diekspos langsung via `GET http://localhost:8081/swagger/*`)
* **Baru:** `docs/openapi/bpjs-api.yaml` (diekspos langsung via `GET http://localhost:8082/swagger/*`)
* **Baru:** `docs/openapi/insurer-api.yaml` (diekspos langsung via `GET http://localhost:8083/swagger/*`)
* **Baru:** `docs/http-client/` (file `.http` standar untuk VS Code REST Client / JetBrains HTTP Client / **Bruno** local-only collection)
* **Baru:** `docs/FRONTEND_HANDOFF.md` (berisi daftar base URL, daftar akun preset login, penjelasan enum status, dan contoh payload error validasi).

---

# 👥 Pembagian Tugas 2 Developer (Dev A & Dev B)

Pembagian dirancang berbasis **Domain & Service Ownership** sehingga kedua developer dapat bekerja secara paralel segera setelah **Fase 0** selesai, dengan risiko konflik file (*merge conflict*) mendekati nol.

## Ringkasan Alokasi Tiket

| Developer | Fokus & Kepemilikan Domain | Daftar Tiket | Total Tiket |
| :--- | :--- | :--- | :--- |
| **Dev A** | **Infrastruktur & Hospital Core Operations:**<br>• Setup Docker Compose, 3 DB Migrations, Seeders & Shared Middlewares<br>• Hospital Auth & Config Mode Simulasi<br>• Direktori Pasien, Registrasi Pasien & Verifikasi BPJS Dummy<br>• Pembuatan Kasus, Detail Kasus & Upload Dokumen<br>• Mesin *Split Bill Calculator* (Simulasi Arbitrary)<br>• Invoice Simulasi, Pencatatan Pembayaran & Rekonsiliasi Finansial | **Fase 0 (Blocking):** `T-001`, `T-002`, `T-003`, `T-004`<br>**Fase 1:** `T-101`, `T-102`, `T-103`, `T-104`, `T-105`, `T-106`, `T-107`, `T-108`<br>**Fase 3:** `T-301`, `T-302`, `T-303`<br>**Fase 4 (Joint):** `T-401`, `T-402` | **15 Tiket Utama** + 2 Joint |
| **Dev B** | **Inter-Service Coordination & Payer Portals:**<br>• Hospital Claim Dispatcher (pengirim JSON ke BPJS & Swasta)<br>• Seluruh **Simulator BPJS Service** (Auth, Dashboard, Receiver, Review & Keputusan)<br>• Seluruh **Asuransi Swasta Service** (Auth, Dashboard, Receiver, Potongan Non-Cover & Keputusan)<br>• Hospital Webhook Receiver, Rekonsiliasi Callback, Komunikasi & Notifikasi<br>• Hospital Dashboard Operasional & Tindak Lanjut Aggregator | **Fase 2:** `T-201`, `T-202`, `T-203`, `T-204`, `T-205`, `T-206`<br>**Fase 3:** `T-304`<br>**Fase 4 (Joint):** `T-401`, `T-402` | **7 Tiket Lintas-Service** + 2 Joint |

---

## Alur Eksekusi Paralel

```
[FASE 0 — Dev A] T-001 (Docker) ──► T-002 (3 DB SQL) ──► T-003 (Seeder) & T-004 (Middleware)
                                                                  │
                        ┌─────────────────────────────────────────┴─────────────────────────────────────────┐
                        ▼                                                                                   ▼
[TRACK DEV A — Hospital Core]                                              [TRACK DEV B — Payers & Webhook Sync]
• T-101: Hospital Auth & Simulation Mode                                   • T-202 & T-203: Simulator BPJS Service (Full)
• T-102 s/d T-104: Pasien & Kepesertaan                                    • T-204 & T-205: Asuransi Swasta Service (Full)
• T-105 s/d T-107: Kasus & Upload Dokumen                                  • T-201: Hospital Subclaim Dispatcher
• T-108: Arbitrary Split Bill Calculator                                   • T-206: Hospital Webhook Receiver & Notif
• T-301 s/d T-303: Invoice, Pembayaran & Rekonsiliasi                      • T-304: Hospital Dashboard KPI Aggregator
                        │                                                                                   │
                        └─────────────────────────────────────────┬─────────────────────────────────────────┘
                                                                  ▼
                     [FASE 4 — Dev A & Dev B] T-401 (E2E Integration Test) ──► T-402 (OpenAPI & Local .http)
```

---

## Batas Kepemilikan File (Anti-Conflict Map)

* **Shared Contracts (`pkg/contracts/fhir_dto.go`):** Dikunci pada `T-001`. Jika ada perubahan field JSON antar-service, wajib disepakati bersama sebelum di-merge.
* **Folder Dev A:**
  * `docker-compose.yml`, `pkg/*`
  * `services/hospital-service/migrations/*`, `services/hospital-service/internal/seed/*`
  * `services/hospital-service/internal/handlers/{auth,patient,case,document,splitbill,invoice,payment}_handler.go`
* **Folder Dev B:**
  * `services/bpjs-service/*` (seluruh handler, service, dan repository BPJS)
  * `services/insurer-service/*` (seluruh handler, service, dan repository Asuransi Swasta)
  * `services/hospital-service/internal/handlers/{subclaim_dispatch,webhook,communication,notification,dashboard}_handler.go`

---

# 🎯 Coordination Rules & Git Workflow

1. **Contract-First Integration:** Selama Dev A mengerjakan `T-105` hingga `T-108`, Dev B dapat langsung menguji `bpjs-service` dan `insurer-service` menggunakan payload JSON dummy sesuai struktur `pkg/contracts/fhir_dto.go` dan data seed dari `T-003`.
2. **Idempotency pada Webhook:** Endpoint `POST /api/webhooks/claims` dan `POST /api/webhooks/claim-response` wajib mengecek `subclaim_code` dan status terkini agar pengiriman ulang (*retry*) tidak menggandakan record atau mengacaukan saldo pembayaran.
3. **Standard Error untuk Validasi Form:** Semua error validasi input (seperti field kosong saat *Buat Kasus* atau *overpayment* saat input pembayaran) wajib mengembalikan struktur `error.details[]` agar tim Frontend cukup membuat satu komponen handler alert/toast global.
4. **Privasi & Local-Only Tooling:** Dilarang mengunggah skema, `.env`, atau contoh payload proyek ke workspace cloud pihak ketiga (termasuk Postman Cloud). Gunakan `docs/http-client/*.http` atau **Bruno** offline collection di dalam repo Git.
5. **Definition of Done (Siap Oper ke Frontend):**
   * `docker compose up --build` berjalan bersih dari nol (`fresh volume`).
   * Seluruh endpoint pada 15 rancangan layar Frontend tersedia, merespons sesuai format standar, dan memiliki data seed yang langsung tampil di UI.
   * Spesifikasi `openapi.yaml` (Swagger UI) dan file `.http` lokal ter-update sesuai implementasi akhir.

---

# 🧩 Catatan Implementasi Dev A (22 November 2026)

Dokumentasi lengkap: [Implementasi Backend Dev A (Markdown)](./implementasi-backend-dev-a.md). [Infografik PNG](./implementasi-backend-dev-a.png) adalah ringkasan visual tambahan.

Implementasi backend Dev A saat ini tersedia pada `cmd/api`, `internal/`, dan `pkg/`. Tiga container API menggunakan binary Go yang sama dengan konfigurasi service berbeda, serta tetap terhubung ke tiga database PostgreSQL yang terisolasi.

* **Sudah diimplementasikan:** fondasi Docker/migrasi/seeder/kontrak dan middleware; Hospital auth/config, direktori dan registrasi pasien, profil/kepesertaan, kasus, upload dan checklist dokumen, split-bill, invoice, pembayaran, serta ringkasan pembayaran/rekonsiliasi (`T-001`–`T-004`, `T-101`–`T-108`, `T-301`–`T-303`).
* **Masih menunggu Dev B:** endpoint adjudikasi BPJS/Asuransi, pengajuan/callback klaim antar-service, notifikasi dan dashboard operasional. Binary BPJS/Asuransi saat ini memiliki health check, login demo, dan profil pengguna agar fondasi service dapat diuji.
* **Fase 4 sengaja belum dimulai:** `T-401` dan `T-402` dikerjakan bersama setelah pekerjaan Dev B tersedia. Swagger/OpenAPI, koleksi `.http`, serta pengujian E2E lintas penjamin belum menjadi bagian implementasi ini.
* **Batas simulasi:** verifikasi BPJS adalah dummy lokal; pengiriman invoice pasien hanya mencatat aktivitas, bukan mengirim pesan keluar.