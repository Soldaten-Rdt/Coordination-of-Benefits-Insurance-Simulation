# 🏥 KAPJ Flow — Health Insurance Coordination of Benefits (CoB) Simulator

[![Go](https://img.shields.io/badge/Backend-Golang-00ADD8?style=flat&logo=go)](https://go.dev/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%20%7C%20TypeScript-000000?style=flat&logo=nextdotjs)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Orchestration-Docker%20Compose-2496ED?style=flat&logo=docker)](https://www.docker.com/)

**KAPJ Flow** adalah platform simulator berbasis web untuk memodelkan alur **Koordinasi Antar Penyelenggara Jaminan (KAPJ)** / ***Coordination of Benefits* (CoB)** antara **Fasilitas Pelayanan Kesehatan (Rumah Sakit)**, **BPJS Kesehatan (Penjamin Primer)**, dan **Asuransi Kesehatan Swasta (Penjamin Sekunder)**.

Proyek ini dikembangkan dalam rangka mata kuliah **Kapita Selekta Rekayasa Perangkat Lunak dan Data — Universitas Gadjah Mada (2026)** untuk mensimulasikan pengelolaan dokumen klaim multi-penjamin, kalkulasi pembagian biaya (*split bill*), adjudikasi klaim independen, hingga rekonsiliasi pembayaran akhir pasien.

---

## 🏗️ Arsitektur Sistem

Sistem dibangun dengan arsitektur **3 aplikasi mandiri (*standalone services*)** yang masing-masing memiliki container Frontend, Backend API, dan Database PostgreSQL terpisah dalam satu jaringan internal Docker (`kapj-network`).

Ketiga aplikasi berkomunikasi secara asinkron/sinkron melalui **HTTP REST & Webhook** menggunakan kontrak payload JSON terstandar yang mengadaptasi struktur resource **HL7 FHIR** (`Patient`, `Coverage`, `Claim`, `ClaimResponse`, dan `Communication`).

```text
+-----------------------------------------------------------------------------------+
|                            DOCKER NETWORK (kapj-network)                          |
|                                                                                   |
|  +---------------------------+    FHIR-like JSON     +-------------------------+  |
|  |   1. HOSPITAL WORKSPACE   | --------------------> |    2. SIMULATOR BPJS    |  |
|  |  Next.js (:3001)          |   Claim / Message     |   Next.js (:3002)       |  |
|  |  Golang API (:8081)       | <-------------------- |   Golang API (:8082)    |  |
|  |  PostgreSQL (:5432)       |     ClaimResponse     |   PostgreSQL (:5433)    |  |
|  +---------------------------+                       +-------------------------+  |
|               |                                                                   |
|               |  FHIR-like JSON (Claim / ClaimResponse / Communication)           |
|               v                                                                   |
|  +---------------------------+                                                    |
|  |   3. ASURANSI SWASTA      |                                                    |
|  |  Next.js (:3003)          |                                                    |
|  |  Golang API (:8083)       |                                                    |
|  |  PostgreSQL (:5434)       |                                                    |
|  +---------------------------+                                                    |
+-----------------------------------------------------------------------------------+
```

### Pemetaan Service & Port

| Aplikasi / Node | Frontend (Next.js) | Backend API (Golang) | Database (PostgreSQL) | Peran dalam Ekosistem |
| :--- | :--- | :--- | :--- | :--- |
| **Hospital Workspace** | `http://localhost:3001` | `http://localhost:8081` | `localhost:5432` (`hospital_db`) | Registrasi pasien, pembuatan kasus, upload dokumen, simulasi *split bill*, & rekonsiliasi pembayaran. |
| **Simulator BPJS** | `http://localhost:3002` | `http://localhost:8082` | `localhost:5433` (`bpjs_db`) | *Primary Payer* — Verifikasi SEP, kode ICD-10/ICD-9-CM, tarif referensi INA-CBGs, & keputusan klaim primer. |
| **Asuransi Swasta** | `http://localhost:3003` | `http://localhost:8083` | `localhost:5434` (`insurer_db`) | *Secondary Payer (CoB)* — Verifikasi plafon polis komersial, potongan item non-cover, & keputusan klaim selisih. |

---

## ✨ Fitur Utama

### 1. Hospital Workspace (`hospital-service` & `hospital-web`)
* **Dashboard Operasional & Tindak Lanjut:** Pemantauan KPI kasus aktif, dokumen belum lengkap, antrean review penjamin, pembayaran tertunda, serta daftar kasus yang membutuhkan revisi berkas.
* **Manajemen Pasien & Kepesertaan Ganda:** Pendaftaran pasien dengan kepesertaan BPJS Kesehatan (Primer) dan satu atau lebih polis Asuransi Swasta (Sekunder), dilengkapi simulasi pengecekan kepesertaan VClaim.
* **Pembuatan Kasus & Pengelolaan Dokumen:** Input episode rawat inap/jalan, rincian tagihan per kategori (*Akomodasi, Tindakan, Farmasi/Alkes, Laboratorium*), pengelompokan dokumen wajib per penjamin, serta validasi kelengkapan sebelum pengajuan.
* **Arbitrary Split Bill Calculator:** Mesin simulasi pembagian biaya fleksibel berbasis persentase bebas maupun nominal perkiraan per penjamin (mendukung mode **COB** maupun **Non-COB**).
* **Invoice Simulasi & Rekonsiliasi Finansial:** Kalkulasi otomatis selisih tanggungan pasca-keputusan penjamin, pencatatan transaksi pelunasan (BPJS, Swasta, & Co-Pay/Ekses Pasien), dan pelacakan riwayat aktivitas kasus.

### 2. Simulator BPJS (`bpjs-service` & `bpjs-web`)
* **Dashboard Verifikator JKN:** Antrean subklaim prioritas (`SUB-BPJS-xxx`) dengan indikator *SLA timer*, filter kategori kasus, dan statistik keputusan.
* **Detail Review Klinis & Kepatuhan:** Pemeriksaan kesesuaian diagnosis ICD-10, prosedur ICD-9-CM, dokumen SEP/Resume Medis, checklist kepatuhan 4 poin, serta pengiriman keputusan (`Disetujui Penuh`, `Minta Revisi Berkas`, atau `Tolak Klaim`) ke Rumah Sakit.

### 3. Asuransi Swasta (`insurer-service` & `insurer-web`)
* **Dashboard Adjudikasi CoB:** Pemantauan klaim sekunder (`SUB-AST-xxx`), rasio utilisasi portofolio, dan linimasa aktivitas underwriter.
* **Kalkulasi Adjudikasi & Potongan Non-Cover:** Verifikasi plafon tahunan serta limit kamar harian, simulasi potongan item *non-cover* polis beserta kalkulasi dampaknya terhadap ekses akhir pasien, dan sinkronisasi keputusan kembali ke Rumah Sakit.

---

## 🚀 Cara Menjalankan (Quick Start)

### Prasyarat
* [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/) terpasang di sistem Anda.
* Port `3001-3003`, `5432-5434`, dan `8081-8083` dalam keadaan kosong.

### Langkah Instalasi

1. **Clone repositori ini:**
   ```bash
   git clone https://github.com/<username-org>/kapj-flow-simulator.git
   cd kapj-flow-simulator
   ```

2. **Salin konfigurasi environment:**
   ```bash
   cp .env.example .env
   ```

3. **Build dan jalankan seluruh container:**
   ```bash
   docker compose up --build -d
   ```

4. **Verifikasi status layanan:**
   Pastikan seluruh container berstatus `healthy` atau `running`:
   ```bash
   docker compose ps
   ```
   Saat pertama kali dijalankan, masing-masing service Golang akan mengeksekusi **migrasi database PostgreSQL** dan **seeder data demo** secara otomatis.

5. **Akses Aplikasi:**
   * **Hospital Workspace:** [http://localhost:3001](http://localhost:3001)
   * **Simulator BPJS:** [http://localhost:3002](http://localhost:3002)
   * **Asuransi Swasta:** [http://localhost:3003](http://localhost:3003)

---

## 🔐 Akun Demo (Preset Credentials)

Gunakan akun preset berikut (atau tombol **Terapkan / Isi Preset** pada halaman Login masing-masing portal) untuk menguji alur simulasi *end-to-end*:

| Portal Aplikasi | Nama & Jabatan | Email | Kata Sandi |
| :--- | :--- | :--- | :--- |
| **Hospital Workspace** | Siti Rahmawati, S.Kep *(Admin Billing RS)* | `siti.rahmawati@rs-jantung.co.id` | `KasirRS#2025` |
| **Simulator BPJS** | dr. Triana M., Sp.A *(Reviewer Medis JKN)* | `triana.mayasari@bpjs-kesehatan.go.id` | `reviewerBpjs2025!` |
| **Asuransi Swasta** | Bambang Sudarsono, S.E., AAK *(Senior Underwriter)* | `bambang.sudarsono@sehatsentosa.co.id` | `SecurityToken@2025!` |

---

## 📖 Dokumentasi API & Pengujian Lokal

Seluruh kontrak API dan koleksi pengujian disimpan **100% secara lokal** di dalam repositori ini menggunakan standar **OpenAPI 3.0** (tanpa ketergantungan layanan cloud pihak ketiga):

* **Swagger UI — Hospital API:** `http://localhost:8081/swagger/index.html`
* **Swagger UI — BPJS API:** `http://localhost:8082/swagger/index.html`
* **Swagger UI — Asuransi Swasta API:** `http://localhost:8083/swagger/index.html`
* **Local HTTP Collection:** Lihat direktori `docs/http-client/` untuk koleksi file `.http` (kompatibel dengan **VS Code REST Client**, **JetBrains HTTP Client**, atau **Bruno**).

---

## 📂 Struktur Direktori Proyek

```text
kapj-flow-simulator/
├── apps/
│   ├── hospital-web/          # Next.js + TypeScript (Portal Rumah Sakit)
│   ├── bpjs-web/              # Next.js + TypeScript (Portal Verifikator BPJS)
│   └── insurer-web/           # Next.js + TypeScript (Portal Asuransi Swasta)
├── services/
│   ├── hospital-service/      # Golang API + Migrasi & Seeder hospital_db
│   ├── bpjs-service/          # Golang API + Migrasi & Seeder bpjs_db
│   └── insurer-service/       # Golang API + Migrasi & Seeder insurer_db
├── pkg/
│   ├── contracts/             # Shared FHIR-inspired JSON DTOs
│   ├── middleware/            # JWT Auth & Inter-Service Webhook Auth
│   ├── httpclient/            # Webhook Dispatcher antar-container
│   └── response/              # Standard JSON Response & Error Wrapper
├── docs/
│   ├── openapi/               # Spesifikasi OpenAPI 3.0 YAML
│   ├── http-client/           # Koleksi pengujian lokal (.http / Bruno)
│   └── FRONTEND_HANDOFF.md    # Panduan integrasi API untuk Frontend
├── docker-compose.yml
└── .env.example
```

---

## 👥 Tim Pengembang — Kelompok Warung Makan Monggo

**Universitas Gadjah Mada Yogyakarta — 2026**

1. **Dhimas Early Oceandy** — `24/533508/PA/22584`
2. **Rafael Mahardika Arya Dewamurti** — `24/536279/PA/22755`
3. **Bobby Rahman Hartanto** — `24/539383/PA/22903`
4. **Fahmi Abdillah Zain** — `24/539422/PA/22904`
5. **Muhammad Dhafin Alfeizar Gandhang** — `24/539735/PA/22916`
6. **Raditya Nathaniel Nugroho** — `24/543188/PA/23069`