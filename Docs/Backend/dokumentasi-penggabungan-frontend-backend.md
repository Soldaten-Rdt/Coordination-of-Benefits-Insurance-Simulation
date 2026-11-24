# Dokumentasi Penggabungan Frontend dan Backend

Dokumen ini menjadi panduan integrasi frontend dengan backend KAPJ Flow. Isinya merangkum cara menjalankan service, autentikasi, kontrak respons, alur bisnis, endpoint per portal, dan batasan simulasi.

> **Status:** backend siap diintegrasikan oleh frontend untuk simulasi lokal. Frontend Next.js belum termasuk dalam repository ini. Dokumen ini tidak mengubah layanan simulasi menjadi sistem produksi.

## 1. Referensi Implementasi

Gunakan spesifikasi OpenAPI sebagai sumber utama request, parameter, dan respons:

- [Hospital API](../openapi/hospital-api.yaml)
- [BPJS API](../openapi/bpjs-api.yaml)
- [Insurer API](../openapi/insurer-api.yaml)

Panduan frontend, kredensial demo, enum, dan alur E2E tersedia di [Frontend Handoff](../FRONTEND_HANDOFF.md). Implementasi per domain dijelaskan di [Backend Dev A](./implementasi-backend-dev-a.md) dan [Backend Dev B](./implementasi-backend-dev-b.md). Rancangan dan daftar tiket ada di [rencana engineering backend](./kapj_flow_backend_engineering_ticketing_plan.md).

## 2. Arsitektur dan Base URL

Satu binary Go dijalankan sebagai tiga service terpisah. Setiap service memiliki database PostgreSQL sendiri.

| Portal | Frontend (rencana) | Backend API | Peran |
|---|---:|---:|---|
| Hospital Workspace | `http://localhost:3001` | `http://localhost:8081` | Pasien, kasus, dokumen, split bill, pengajuan, invoice, pembayaran |
| Simulator BPJS | `http://localhost:3002` | `http://localhost:8082` | Review dan adjudikasi klaim primer |
| Asuransi Swasta | `http://localhost:3003` | `http://localhost:8083` | Review dan adjudikasi klaim sekunder CoB |

Database lokal dipetakan ke port `5432` (Hospital), `5433` (BPJS), dan `5434` (Insurer). Frontend hanya berkomunikasi dengan API; jangan hubungkan browser langsung ke database.

## 3. Menjalankan Backend Lokal

Di PowerShell, dari root repository:

```powershell
Copy-Item .env.example .env
```

Edit `.env` sebelum menjalankan Compose. Ganti `JWT_SECRET` dan `KAPJ_SERVICE_KEY` dengan nilai acak masing-masing minimal 32 karakter. Jangan commit `.env` atau mengekspos `KAPJ_SERVICE_KEY` ke browser.

```powershell
docker compose up --build -d
docker compose ps

Invoke-RestMethod http://localhost:8081/health
Invoke-RestMethod http://localhost:8082/health
Invoke-RestMethod http://localhost:8083/health
```

Dokumentasi API tersedia di:

- `http://localhost:8081/swagger/`
- `http://localhost:8082/swagger/`
- `http://localhost:8083/swagger/`

OpenAPI YAML tersedia dari API masing-masing pada `/swagger/openapi.yaml`. Halaman Swagger UI memuat aset CSS/JavaScript dari unpkg CDN sehingga tampilan UI interaktif memerlukan internet; file spesifikasinya tetap dilayani oleh backend lokal.

## 4. CORS, Auth, dan Format Respons

### CORS

Ketiga API menerima origin frontend lokal berikut:

- `http://localhost:3001`
- `http://localhost:3002`
- `http://localhost:3003`

Header browser yang diizinkan meliputi `Authorization` dan `Content-Type`. Header `X-KAPJ-Service-Key` dan `X-KAPJ-Source-Node` adalah untuk komunikasi antar-service, **bukan** untuk disimpan atau dikirim oleh frontend.

### Login dan Bearer token

Setiap portal memiliki endpoint `POST /api/auth/login`. Login menghasilkan `data.access_token` dan informasi pengguna. Sertakan token pada request terproteksi:

```http
Authorization: Bearer <access_token>
```

Gunakan akun demo yang tercantum di [Frontend Handoff](../FRONTEND_HANDOFF.md) untuk pengembangan lokal. Logout bersifat stateless: server tidak mencabut token yang telah diterbitkan; token berlaku hingga kedaluwarsa. Jangan jadikan kredensial demo sebagai konfigurasi produksi.

Role pengguna tersedia dalam respons login. Frontend dapat menggunakannya untuk menampilkan navigasi dan aksi yang sesuai, tetapi backend saat ini belum menerapkan otorisasi granular berbasis role pada setiap endpoint.

### Response envelope

Respons sukses umumnya berbentuk:

```json
{
  "success": true,
  "data": {}
}
```

Respons list juga dapat memiliki `meta` untuk pagination. Error validasi atau bisnis menggunakan `success: false` dan `error` yang berisi `code`, `message`, serta opsional `details`. Frontend sebaiknya menampilkan pesan yang sesuai dan menangani `401`, `403`, `404`, `409`, `422`, dan `502` secara terpisah.

## 5. Alur Integrasi Utama

### A. Hospital: membuat dan mengajukan kasus

1. Login ke Hospital API.
2. Buat pasien melalui `POST /api/patients`, lalu buat kasus dengan `POST /api/cases`.
3. Unggah file ke `POST /api/documents/upload` menggunakan multipart field `file`.
4. Kaitkan metadata file ke checklist kasus melalui `POST /api/cases/{id}/documents`.
5. Hitung split dengan `POST /api/cases/{id}/split-bill/calculate`, lalu terapkan dengan `POST /api/cases/{id}/split-bill/apply`.
6. Ajukan subklaim melalui `POST /api/cases/{id}/subclaims/submit`.
7. Pantau status kasus, dashboard, komunikasi, dan notifikasi melalui endpoint Hospital.
8. Setelah keputusan penjamin diterima, tampilkan invoice dan catat pembayaran melalui API Hospital.

Payload kalkulasi split persentase, misalnya:

```json
{
  "split_method": "PERCENTAGE",
  "bpjs_percent": 30,
  "insurer_percent": 58,
  "patient_percent": 12
}
```

Backend menghitung bagian pasien sebagai sisa agar total alokasi seimbang. Pada mode `NON_COB`, porsi insurer menjadi nol.

### B. Review BPJS

BPJS menerima klaim dari dispatcher Hospital. Reviewer dapat memakai:

- `GET /api/dashboard/summary`
- `GET /api/claims`
- `GET /api/claims/{subclaimCode}`
- `PATCH /api/claims/{subclaimCode}/status`
- `POST /api/claims/{subclaimCode}/decide`

Keputusan yang didukung: `APPROVED`, `REVISION_REQUIRED`, dan `REJECTED`. Keputusan dikirim ke Hospital melalui webhook internal; frontend tidak perlu memanggil webhook callback.

### C. Review Asuransi Swasta

Portal insurer menyediakan antrean dan detail klaim, preview adjudikasi, serta keputusan:

- `GET /api/dashboard/summary`
- `GET /api/claims`
- `GET /api/claims/{subclaimCode}`
- `PATCH /api/claims/{subclaimCode}/status`
- `POST /api/claims/{subclaimCode}/adjudicate-preview`
- `POST /api/claims/{subclaimCode}/decide`

Keputusan insurer dapat menyertakan `non_cover_deduction` dan `deduction_reason`. Backend mengirim callback keputusan ke Hospital untuk rekonsiliasi.

### D. Revisi, rekonsiliasi, dan pembayaran

Jika penjamin meminta revisi:

1. Hospital menerima perubahan status menjadi `ACTION_REQUIRED` dan membuat notifikasi.
2. Frontend menampilkan tindak lanjut dari `GET /api/dashboard/action-required` atau `GET /api/notifications`.
3. Setelah dokumen diperbaiki, kirim ulang melalui `POST /api/cases/{id}/subclaims/{subclaimId}/resubmit`.
4. Setelah seluruh keputusan diterima, ambil invoice dari `GET /api/cases/{id}/invoice`.
5. Catat transaksi melalui `POST /api/cases/{id}/payments`. Backend menolak nominal yang melebihi alokasi/saldo tersisa.

Tidak ada WebSocket/SSE pada implementasi saat ini. Untuk memperbarui dashboard/status, frontend dapat melakukan refresh atau polling endpoint yang relevan.

## 6. Dokumen dan File Upload

Upload menerima PDF, JPG/JPEG, atau PNG dengan ukuran maksimum 10 MB. Alur yang disarankan:

1. Unggah file dan ambil `file_url`, `file_name`, `file_size`, serta `mime_type` dari respons.
2. Kirim metadata tersebut saat mengaitkan dokumen ke kasus.
3. Gunakan `file_url` untuk menampilkan atau mengunduh file; route `/uploads/{year}/{month}/{fileName}` memerlukan Bearer token.

Checklist dokumen wajib berbeda menurut mode dan coverage pasien. Pengajuan akan ditolak jika split bill belum diterapkan atau dokumen wajib belum valid.

## 7. Status yang Umum Ditampilkan

| Area | Nilai utama |
|---|---|
| Mode simulasi | `COB`, `NON_COB` |
| Status koordinasi | `IN_PROGRESS`, `IN_REVIEW`, `ACTION_REQUIRED`, `APPROVED`, `SETTLED` |
| Status subklaim | `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `REVISION_REQUIRED`, `APPROVED`, `REJECTED` |
| Status pembayaran | `UNPAID`, `PARTIAL`, `PAID` |
| Keputusan reviewer | `APPROVED`, `REVISION_REQUIRED`, `REJECTED` |

Jangan menyimpulkan status kasus hanya dari respons satu aksi; setelah callback atau perubahan reviewer, baca ulang detail kasus atau dashboard Hospital.

## 8. Pengujian Integrasi

Unit test dan static analysis:

```powershell
go test ./...
go vet ./...
```

Untuk E2E, jalankan tiga API melalui Docker Compose, lalu:

```powershell
$env:KAPJ_E2E = "1"
go test ./internal/server -run '^TestE2ECoBRevisionAndNonCoB$' -count=1 -v
```

Test memverifikasi health dan spesifikasi API, alur CoB hingga lunas, validasi dokumen wajib, notifikasi/dashboard revisi dan resubmit, serta Non-CoB yang hanya mengirim klaim ke BPJS. Test membuat pasien, kasus, transaksi, notifikasi, dan file uji pada database/volume yang sedang aktif; gunakan volume disposable bila tidak ingin data uji tersimpan.

## 9. Batasan dan Tanggung Jawab Sebelum Produksi

- Ini adalah simulator: verifikasi BPJS tidak terhubung ke VClaim dan pembayaran/bank tidak terhubung ke jaringan eksternal.
- Akun serta data seed adalah data demo.
- Backend belum menerapkan RBAC granular; jangan mengandalkan pembatasan UI sebagai kontrol keamanan produksi.
- Logout tidak mencabut token secara server-side.
- Swagger UI memerlukan akses internet untuk aset CDN.
- Frontend harus menangani timeout/kegagalan layanan, status revisi, error validasi, serta pembaruan status setelah callback.

Dengan batasan tersebut, frontend dapat mulai mengintegrasikan portal lokal menggunakan base URL, kontrak OpenAPI, dan alur pada dokumen ini.
