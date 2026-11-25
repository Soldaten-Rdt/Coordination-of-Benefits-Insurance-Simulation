# 🤝 KAPJ Flow — Frontend Integration & Handoff Guide

> **Target Pengguna:** Frontend Engineer (Next.js + TypeScript)  
> **Backend Architecture:** 3 Standalone Go Services (`hospital-service`, `bpjs-service`, `insurer-service`)  
> **Status:** Siap Integrasi End-to-End (*Production-Ready Local Simulation*)

---

## 1. Topologi Service & Base URL

| Service | Port Host | Base API URL | Swagger UI (Scalar/OpenAPI) | Keterangan |
| :--- | :---: | :--- | :--- | :--- |
| **Hospital Service** | `8081` | `http://localhost:8081` | `http://localhost:8081/swagger/` | Core RS: Pasien, Kasus, Split Bill, Dispatcher & Invoice |
| **BPJS Service** | `8082` | `http://localhost:8082` | `http://localhost:8082/swagger/` | Portal Verifikator Medis JKN (Primer) |
| **Asuransi Swasta** | `8083` | `http://localhost:8083` | `http://localhost:8083/swagger/` | Portal Adjudikator Asuransi Tambahan (Sekunder CoB) |

> **CORS Policy:** Ketiga service Go telah mengizinkan origin frontend `http://localhost:3001` (Hospital Web), `http://localhost:3002` (BPJS Web), dan `http://localhost:3003` (Insurer Web) dengan header `Authorization, Content-Type, X-KAPJ-Service-Key, X-KAPJ-Source-Node`.
>
> Spesifikasi OpenAPI di `/swagger/openapi.yaml` dilayani lokal. Halaman Swagger UI memuat aset CSS/JavaScript dari unpkg CDN, jadi UI interaktif memerlukan internet; frontend juga dapat memakai file OpenAPI lokal dan koleksi REST client.

---

## 2. Kredensial Akun Preset Login Demo

Gunakan kredensial berikut untuk tombol **Quick Login / Terapkan Kredensial Demo** di form login masing-masing portal:

### A. Hospital Workspace (`:8081` / Frontend `:3001`)
* **Email:** `siti.rahmawati@rs-jantung.co.id`
* **Password:** `KasirRS#2025`
* **Nama & Role:** Siti Rahmawati, S.Kep — *Admin Billing & Casemix* (`ADMIN_BILLING_RS`)
* **Institusi:** RS Jantung Nusantara

### B. BPJS Verifier Portal (`:8082` / Frontend `:3002`)
* **Email:** `triana.mayasari@bpjs-kesehatan.go.id`
* **Password:** `reviewerBpjs2025!`
* **Nama & Role:** dr. Triana M., Sp.A — *Reviewer Medis & Administrasi* (`REVIEWER_BPJS`)
* **Cabang:** BPJS Cabang Utama

### C. Asuransi Swasta Portal (`:8083` / Frontend `:3003`)
* **Email:** `bambang.sudarsono@sehatsentosa.co.id`
* **Password:** `SecurityToken@2025!`
* **Nama & Role:** Bambang Sudarsono, S.E., AAK — *Senior Claim Underwriter* (`REVIEWER_SWASTA`)
* **Entitas:** PT Asuransi Sehat Sentosa (Batas Otoritas: Rp 100.000.000)

---

## 3. Konvensi Standard Response Envelope

Seluruh endpoint backend mengembalikan envelope seragam:

### A. Data Tunggal (Object)
```json
{
  "success": true,
  "data": { ... }
}
```

### B. Data List dengan Pagination (Array)
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

### C. Operasi Aksi State (Pesan Sukses)
```json
{
  "success": true,
  "message": "Subklaim berhasil diajukan ke penjamin"
}
```

### D. Standard Validation / Business Error Response
Jika request tidak memenuhi validasi form atau prasyarat bisnis:
```json
{
  "success": false,
  "error": {
    "code": "MISSING_REQUIRED_DOCUMENTS",
    "message": "Seluruh dokumen wajib untuk penjamin terkait harus berstatus valid dan terunggah sebelum pengajuan",
    "details": [
      {
        "field": "documents.SEP",
        "message": "Dokumen SEP untuk BPJS wajib diunggah dan berstatus valid"
      },
      {
        "field": "documents.GL_ASURANSI",
        "message": "Dokumen GL_ASURANSI untuk PRIVATE_INSURANCE wajib diunggah dan berstatus valid"
      }
    ]
  }
}
```

---

## 4. Panduan Enum Status & Siklus Kasus

### A. Tahapan Alur Kasus (`workflow_step` 1..6)
1. `1` — **Kasus Dibuat:** Form registrasi kasus awal, item tagihan RS awal, checklist dokumen digenerate otomatis.
2. `2` — **Berkas Dokumen:** Seluruh dokumen wajib (`is_mandatory = TRUE`) telah diunggah dan tervalidasi.
3. `3` — **Simulasi Split Bill:** Simulasi pembagian biaya (arbitrary percentage atau nominal) telah dihitung & diterapkan (`is_applied = true`).
4. `4` — **Review Penjamin:** Subklaim telah diajukan ke gateway BPJS dan/atau Asuransi Swasta (`status = SUBMITTED / IN_REVIEW`).
5. `5` — **Rekonsiliasi Split:** Penjamin telah mengembalikan keputusan persetujuan/potongan; ekses pasien final telah direkonsiliasi; siap pembayaran.
6. `6` — **Discharge & Pelunasan:** Pembayaran dari seluruh pihak (BPJS + Swasta + Pasien) lunas 100% (`payment_status = PAID`).

### B. Status Koordinasi Kasus (`coordination_status`)
* `IN_PROGRESS`: Kasus sedang dalam penyiapan data atau berkas dokumen di RS.
* `IN_REVIEW`: Subklaim sedang dalam antrean verifikasi penjamin.
* `ACTION_REQUIRED`: Terdapat penjamin yang meminta revisi berkas (`REVISION_REQUIRED`). Perlu tindakan admin RS.
* `APPROVED`: Seluruh penjamin menyetujui subklaim.
* `SETTLED`: Keputusan final penjamin telah selesai direkonsiliasi.

### C. Status Subklaim Penjamin (`subclaims.status`)
* `DRAFT`: Baru dibuat dari kalkulasi split bill di RS.
* `SUBMITTED`: Telah dikirimkan via HTTP webhook ke portal penjamin.
* `IN_REVIEW`: Sedang dibuka & diperiksa oleh reviewer/underwriter penjamin.
* `REVISION_REQUIRED`: Penjamin meminta perbaikan dokumen / klarifikasi klinis.
* `APPROVED`: Disetujui (penuh atau dengan potongan non-cover).
* `REJECTED`: Klaim ditolak penjamin.

### D. Status Pembayaran (`payment_status`)
* `UNPAID`: Belum ada pembayaran masuk sama sekali.
* `PARTIAL`: Sebagian dana telah diterima (misal DP pasien atau salah satu penjamin).
* `PAID`: Seluruh tagihan rumah sakit telah lunas 100%.

---

## 5. Ringkasan Alur Pengujian End-to-End (E2E Happy Path)

```
[RS] Login Petugas
  │
  ▼
[RS] Registrasi Pasien (BPJS + Polis Swasta) ──► Buat Kasus Rawat Inap (KAS-2026-xxx)
  │
  ▼
[RS] Unggah Dokumen Wajib (SEP, Resume Medis, Billing Rinci, GL Asuransi, Rincian BHP)
  │
  ▼
[RS] Hitung Split Bill Arbitrary (POST /api/cases/:id/split-bill/calculate) ──► Apply (POST /api/cases/:id/split-bill/apply)
  │
  ▼
[RS] Dispatch Subklaim (POST /api/cases/:id/subclaims/submit)
  │
  ├──► [BPJS :8082] Reviewer Login ──► Buka Antrean Klaim ──► Setujui Klaim (POST /api/claims/:code/decide)
  │                                                                 │ (Webhook Callback)
  │                                                                 ▼
  │                                                      [RS :8081] Menerima Persetujuan BPJS
  │
  └──► [Swasta :8083] Underwriter Login ──► Preview Potongan Non-Cover ──► Setujui Klaim (POST /api/claims/:code/decide)
                                                                    │ (Webhook Callback)
                                                                    ▼
                                                         [RS :8081] Menerima Persetujuan Swasta
  │
  ▼
[RS] Sistem merekonsiliasi ekses pasien secara otomatis (Workflow Step 5)
  │
  ▼
[RS] Buka Invoice (GET /api/cases/:id/invoice)
  │
  ▼
[RS] Catat Pembayaran BPJS, Asuransi Swasta, dan Pelunasan Pasien (POST /api/cases/:id/payments)
  │
  ▼
[RS] Status Kasus berubah menjadi Lunas (PAID) & Selesai (Workflow Step 6)
```

---

## 6. Local Testing Tools

* **Interactive Swagger UI:** Buka langsung di browser tanpa instalasi apapun:
  * Hospital API: [http://localhost:8081/swagger/](http://localhost:8081/swagger/)
  * BPJS API: [http://localhost:8082/swagger/](http://localhost:8082/swagger/)
  * Insurer API: [http://localhost:8083/swagger/](http://localhost:8083/swagger/)
* **VS Code / JetBrains REST Client:** Gunakan file `.http` di folder `Docs/http-client/`:
  * `hospital.http`
  * `bpjs.http`
  * `insurer.http`
* **Bruno API Collection:** Buka folder `Docs/http-client/bruno/` pada aplikasi Bruno.

## 7. Validasi Backend Sebelum Integrasi

Jalankan unit test dan static analysis dari root repository:

```powershell
go test ./...
go vet ./...
```

Dengan ketiga API berjalan melalui Docker Compose, jalankan test lintas-service:

```powershell
$env:KAPJ_E2E = "1"
go test ./internal/server -run '^TestE2ECoBRevisionAndNonCoB$' -count=1 -v
```

Test E2E mencakup alur CoB sampai lunas, permintaan revisi dan resubmit, validasi dokumen wajib, serta Non-CoB yang hanya dikirim ke BPJS. Test membuat pasien, kasus, transaksi, notifikasi, dan file simulasi pada database/volume yang sedang aktif; gunakan database disposable bila ingin menghindari data uji tersimpan.
