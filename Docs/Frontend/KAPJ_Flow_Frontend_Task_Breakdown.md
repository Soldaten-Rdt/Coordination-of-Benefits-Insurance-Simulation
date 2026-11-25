# KAPJ Flow — Frontend Task Breakdown (3 Developers)

> **Tujuan:** Membagi implementasi frontend KAPJ Flow kepada Dev 1, Dev 2, dan Dev 3 berdasarkan domain fitur agar pengerjaan dapat berjalan paralel dengan batas kepemilikan file yang jelas.
>
> **Stack:** Next.js + TypeScript  
> **Arsitektur:** 3 aplikasi frontend terpisah — Hospital Workspace, Simulator BPJS, dan Asuransi Swasta.  
> **Sumber acuan:** Rancangan UI/UX KAPJ Flow, `README.md`, dan `kapj_flow_backend_engineering_ticketing_plan.md`.

---

## 1. Gambaran pembagian

| Developer | Fokus utama | Aplikasi / domain |
|---|---|---|
| **Dev 1** | Fondasi frontend, autentikasi, dashboard operasional, dan manajemen pasien | `hospital-web` |
| **Dev 2** | Siklus kasus rumah sakit: dokumen, split bill, pengajuan klaim, invoice, dan pembayaran | `hospital-web` |
| **Dev 3** | Portal penjamin: review klaim BPJS dan adjudikasi asuransi swasta | `bpjs-web` dan `insurer-web` |

**Alasan pembagian:**
- Dev 1 menyiapkan fondasi dan halaman awal yang menjadi pintu masuk pengguna Hospital Workspace.
- Dev 2 menangani alur kerja inti setelah pasien dipilih hingga kasus diajukan, direkonsiliasi, dan dibayar.
- Dev 3 memiliki dua portal penjamin yang pola tampilannya serupa (dashboard antrean, detail klaim, dokumen, keputusan), sehingga komponen umum dapat digunakan ulang.
- Setiap developer memiliki domain utama dan sebisa mungkin tidak mengedit halaman atau komponen milik developer lain.

## 2. Dev 1 — Hospital Foundation, Dashboard & Patient Management

**Aplikasi:** `apps/hospital-web`  
**Fokus:** Fondasi proyek Hospital Workspace dan alur dari login sampai pemilihan pasien.

### Tugas

- [ ] **Setup struktur `hospital-web`**
  - Setup Next.js + TypeScript, konfigurasi environment, alias import, dan struktur direktori.
  - Buat layout utama, sidebar, topbar, breadcrumb, area konten, dan responsive behavior sesuai rancangan UI.
  - Siapkan komponen UI bersama: button, input, select, modal, badge status, card KPI, tabel, pagination, toast/alert, loading, dan empty state.
- [ ] **Autentikasi dan konfigurasi**
  - Halaman login Hospital Workspace.
  - Tombol isi/terapkan akun demo.
  - Integrasi `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`.
  - Simpan token secara aman dan buat route guard untuk halaman yang memerlukan autentikasi.
  - Ambil konfigurasi mode simulasi melalui `GET /api/system/config`; dukung perubahan melalui `PATCH /api/system/simulation-mode`.
- [ ] **Dashboard Operasional RS**
  - Kartu KPI: total kasus aktif, dokumen belum lengkap, klaim menunggu review, dan pembayaran tertunda.
  - Daftar kasus terbaru beserta filter tab.
  - Panel *Perlu Tindak Lanjut*.
  - Aktivitas terbaru dan grafik alokasi biaya.
  - Integrasi `GET /api/dashboard/summary`, `/api/dashboard/action-required`, dan `/api/dashboard/activities`.
- [ ] **Direktori Pasien**
  - Kartu ringkasan pasien.
  - Tabel pasien dengan pencarian nama/NIK/kode pasien.
  - Filter status dan penjamin, tab, serta pagination.
  - Integrasi `GET /api/patients` dan `GET /api/patients/summary`.
- [ ] **Registrasi dan Profil Pasien**
  - Form registrasi pasien, identitas, BPJS, polis asuransi swasta, dan unggah dokumen identitas.
  - Tombol simulasi verifikasi BPJS.
  - Halaman profil pasien: biodata, kepesertaan, riwayat kasus, ringkasan klaim, dan linimasa aktivitas.
  - Integrasi `POST /api/patients`, `POST /api/patients/verify-bpjs`, `GET /api/patients/:id`, `PATCH /api/patients/:id`, dan `PATCH /api/patients/:id/coverages`.

### Hasil yang harus diserahkan

- [ ] Hospital Workspace dapat dijalankan dan dinavigasi.
- [ ] Login, logout, proteksi halaman, dan profil pengguna berfungsi.
- [ ] Dashboard dan daftar pasien menampilkan data dari API.
- [ ] Registrasi pasien, verifikasi BPJS, dan halaman profil pasien berfungsi.
- [ ] Komponen UI umum terdokumentasi dan dapat digunakan Dev 2.

### Kepemilikan file

```text
apps/hospital-web/
├── app/(auth)/login/
├── app/(hospital)/layout.tsx
├── app/(hospital)/dashboard/
├── app/(hospital)/patients/
├── components/layout/
├── components/ui/
├── components/patient/
├── lib/auth/
├── lib/api/
└── types/patient.ts
```

> Dev 1 menjadi pemilik komponen layout dan UI bersama. Perubahan pada komponen bersama perlu dikomunikasikan sebelum diubah oleh developer lain.

---

## 3. Dev 2 — Hospital Case Workflow, Split Bill & Settlement

**Aplikasi:** `apps/hospital-web`  
**Fokus:** Alur operasional kasus setelah pasien terdaftar sampai pembayaran selesai.

### Tugas

- [ ] **Pembuatan Kasus**
  - Halaman/form buat kasus dari pasien terpilih.
  - Input rawat inap/rawat jalan, ruang, kelas, DPJP, tanggal masuk/keluar, diagnosis ICD-10, prosedur ICD-9-CM, tarif INA-CBG, dan item tagihan.
  - Tampilkan validasi field wajib dari API.
  - Integrasi `POST /api/cases` dan `GET /api/cases`.
- [ ] **Detail Kasus dan Stepper CoB**
  - Halaman detail kasus.
  - Stepper 6 tahap alur koordinasi.
  - Ringkasan pasien, informasi klinis, rincian tagihan, pembagian biaya, status subklaim, dan aktivitas.
  - Checklist dokumen kritis sebelum pasien pulang.
  - Integrasi `GET /api/cases/:id`, `PATCH /api/cases/:id`, dan `PATCH /api/cases/:id/discharge-checklist`.
- [ ] **Manajemen Dokumen Klaim**
  - Upload PDF/JPG/PNG, daftar dokumen, preview/download, hapus dokumen, dan kategori target penjamin.
  - Tampilkan status dokumen wajib dan dokumen yang masih kurang per penjamin.
  - Integrasi `POST /api/documents/upload`, `POST /api/cases/:id/documents`, `GET /api/cases/:id/documents`, dan `DELETE /api/cases/:id/documents/:docId`.
- [ ] **Split Bill Calculator**
  - UI pemilihan preset dan input persentase.
  - UI input nominal manual.
  - Tampilkan estimasi alokasi BPJS, asuransi swasta, dan pasien serta distribusi per item tagihan.
  - Kunci porsi asuransi swasta ketika mode `NON_COB`.
  - Tombol hitung dan terapkan simulasi.
  - Integrasi `POST /api/cases/:id/split-bill/calculate`, `GET /api/cases/:id/split-bill`, dan `POST /api/cases/:id/split-bill/apply`.
- [ ] **Pengajuan Klaim dan Komunikasi**
  - Ringkasan kesiapan pengajuan, validasi dokumen, tombol ajukan dan ajukan ulang.
  - Tampilkan status subklaim BPJS/swasta, pesan klarifikasi, dan riwayat komunikasi.
  - Integrasi `POST /api/cases/:id/subclaims/submit`, `POST /api/cases/:id/subclaims/:subclaimId/resubmit`, dan `POST /api/cases/:id/messages`.
  - Tampilkan notifikasi dari penjamin dan status dibaca/belum dibaca.
  - Integrasi `GET /api/notifications` dan `PATCH /api/notifications/:id/read`.
- [ ] **Invoice dan Pembayaran**
  - Halaman invoice simulasi CoB: total tagihan, nominal disetujui, pembayaran masuk, sisa tagihan, alokasi per penjamin, dan riwayat transaksi.
  - Form catat transaksi pembayaran dari BPJS, asuransi swasta, atau pasien.
  - Halaman pembayaran lintas kasus, filter status/penjamin, dan rekonsiliasi.
  - Integrasi `GET /api/cases/:id/invoice`, `POST /api/cases/:id/invoice/send-patient`, `POST /api/cases/:id/payments`, `GET /api/payments`, `GET /api/payments/summary`, dan `GET /api/payments/bank-reconciliation`.

### Hasil yang harus diserahkan

- [ ] Alur kasus dari pembuatan hingga detail kasus dapat digunakan.
- [ ] Upload, preview, dan status kelengkapan dokumen berjalan.
- [ ] Kalkulator split bill mendukung mode `COB` dan `NON_COB`.
- [ ] Pengajuan/resubmit klaim dan komunikasi tampil sesuai status backend.
- [ ] Invoice dan pencatatan pembayaran berjalan, termasuk validasi overpayment.
- [ ] Semua perubahan status dan nominal diperbarui dari respons API, bukan dihitung sebagai data final di frontend.

### Kepemilikan file

```text
apps/hospital-web/
├── app/(hospital)/cases/
├── app/(hospital)/documents/
├── app/(hospital)/payments/
├── app/(hospital)/invoices/
├── components/case/
├── components/documents/
├── components/split-bill/
├── components/claim/
├── components/payment/
├── lib/api/cases.ts
├── lib/api/documents.ts
├── lib/api/payments.ts
└── types/case.ts
```

> Dev 2 menggunakan layout dan komponen UI yang disediakan Dev 1. Jangan mengubah `components/layout` atau fondasi autentikasi tanpa koordinasi.

---

## 4. Dev 3 — Payer Portals: BPJS & Asuransi Swasta

**Aplikasi:** `apps/bpjs-web` dan `apps/insurer-web`  
**Fokus:** Dua portal penjamin untuk menerima, memeriksa, dan memutuskan klaim.

### A. Simulator BPJS

- [ ] Setup aplikasi Next.js + TypeScript `bpjs-web`, environment, layout, sidebar, topbar, dan route guard.
- [ ] Halaman login BPJS dengan tombol isi akun demo.
- [ ] Integrasi `POST /api/auth/login` dan `GET /api/me` pada base URL BPJS.
- [ ] Dashboard reviewer:
  - KPI klaim masuk, menunggu review, sedang ditinjau, perlu revisi, dan disetujui bulan ini.
  - Antrean klaim prioritas dan indikator SLA.
  - Filter status/kategori dan pencarian klaim.
  - Distribusi keputusan, faskes mitra, dan aktivitas reviewer.
  - Integrasi `GET /api/dashboard/summary` dan `GET /api/claims`.
- [ ] Detail review klaim:
  - Data pasien dan kepesertaan.
  - Informasi klinis ICD-10/ICD-9-CM, SEP, dan tarif INA-CBG.
  - Dokumen pendukung dan checklist kepatuhan.
  - Catatan reviewer dan riwayat status.
  - Integrasi `GET /api/claims/:subclaimCode`.
- [ ] Aksi keputusan:
  - Setujui klaim.
  - Minta revisi berkas.
  - Tolak klaim.
  - Tampilkan konfirmasi sebelum keputusan dikirim.
  - Integrasi `PATCH /api/claims/:subclaimCode/status` dan `POST /api/claims/:subclaimCode/decide`.

### B. Portal Asuransi Swasta

- [ ] Setup aplikasi Next.js + TypeScript `insurer-web` dengan pola layout dan komponen yang konsisten dengan portal BPJS.
- [ ] Halaman login asuransi swasta dan pemilihan/identitas entitas asuransi sesuai respons backend.
- [ ] Integrasi `POST /api/auth/login` dan `GET /api/me` pada base URL asuransi.
- [ ] Dashboard adjudikasi:
  - KPI klaim masuk, menunggu review, perlu revisi/audit, disetujui bulan ini, dan ekses tertolak.
  - Daftar klaim sekunder CoB terbaru.
  - Ringkasan aturan polis/parameter CoB dan aktivitas adjudikator.
  - Integrasi `GET /api/dashboard/summary` dan `GET /api/claims`.
- [ ] Detail klaim asuransi:
  - Data pasien, polis, batas manfaat, plafon tahunan, dan limit kamar.
  - Informasi klinis dan rincian biaya.
  - Dokumen klaim dan status validasi.
  - Integrasi `GET /api/claims/:subclaimCode`.
- [ ] Kalkulasi dan keputusan adjudikasi:
  - Form simulasi potongan item non-cover dan alasan potongan.
  - Tampilkan nominal pengajuan, rekomendasi persetujuan, dampak ekses pasien, dan persentase pertanggungan.
  - Aksi setujui, minta revisi, atau tolak klaim.
  - Integrasi `POST /api/claims/:subclaimCode/adjudicate-preview`, `PATCH /api/claims/:subclaimCode/status`, dan `POST /api/claims/:subclaimCode/decide`.

### Hasil yang harus diserahkan

- [ ] Login dan dashboard BPJS berfungsi.
- [ ] Reviewer BPJS dapat membuka detail klaim dan mengirim keputusan.
- [ ] Login dan dashboard asuransi swasta berfungsi.
- [ ] Reviewer asuransi dapat melihat polis, menghitung potongan non-cover, dan mengirim keputusan.
- [ ] Status keputusan ditampilkan sesuai respons API dan tersinkron ke Hospital Workspace melalui backend.
- [ ] Komponen yang memang sama (status badge, tabel klaim, panel dokumen, dialog keputusan) dibuat reusable tanpa memaksakan seluruh UI kedua portal menjadi identik.

### Kepemilikan file

```text
apps/
├── bpjs-web/
│   ├── app/(auth)/login/
│   ├── app/(reviewer)/dashboard/
│   ├── app/(reviewer)/claims/
│   ├── components/
│   ├── lib/api/
│   └── types/
└── insurer-web/
    ├── app/(auth)/login/
    ├── app/(reviewer)/dashboard/
    ├── app/(reviewer)/claims/
    ├── components/
    ├── lib/api/
    └── types/
```

---

## 5. Kontrak Integrasi Frontend–Backend

### Base URL

| Aplikasi | Development URL | Backend API |
|---|---|---|
| Hospital Workspace | `http://localhost:3001` | `http://localhost:8081` |
| Simulator BPJS | `http://localhost:3002` | `http://localhost:8082` |
| Asuransi Swasta | `http://localhost:3003` | `http://localhost:8083` |

Simpan base URL di environment masing-masing aplikasi, jangan menuliskannya berulang di komponen.

Contoh:

```env
# apps/hospital-web/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8081

# apps/bpjs-web/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8082

# apps/insurer-web/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8083
```

### Standar request dan response

- Endpoint terproteksi mengirim `Authorization: Bearer <access_token>`.
- Response sukses menggunakan envelope `{ "success": true, "data": ... }`.
- Response list menyertakan `meta` pagination.
- Response error menggunakan `{ "success": false, "error": { "code", "message", "details" } }`.
- Buat satu mekanisme API client per aplikasi untuk mengatur base URL, token, parsing response, dan error.
- Untuk error validasi, tampilkan pesan dari `error.details[]` pada field terkait; jangan hanya menampilkan pesan generik.
- Gunakan enum/status dari kontrak backend. Buat fungsi pemetaan status ke label dan warna UI pada satu tempat.
- Format nominal sebagai Rupiah dan tanggal sesuai kebutuhan tampilan, tetapi simpan nilai mentah dari API sebagai sumber data.

### Catatan integrasi penting

1. Ketiga aplikasi merupakan frontend terpisah dengan backend dan database masing-masing. Jangan mengakses database secara langsung.
2. Pertukaran klaim, keputusan, dan pesan antar-aplikasi dilakukan backend melalui REST/Webhook. Frontend hanya memanggil API milik portal yang sedang digunakan.
3. Jangan mengasumsikan keputusan reviewer langsung mengubah state lokal Hospital Workspace. Ambil ulang data kasus/notifikasi setelah backend menerima callback.
4. Upload dokumen mengikuti batas backend: PDF/JPG/PNG dengan ukuran maksimal 10 MB.
5. Mode `NON_COB` tidak boleh menampilkan atau mengirim alokasi asuransi swasta sebagai penjamin aktif.
6. Jangan meng-hardcode data demo sebagai data produksi. Akun preset hanya untuk kebutuhan pengujian dan harus mengikuti konfigurasi backend.

## 6. Aturan kerja bersama

### Tahap awal — disepakati bersama

- [ ] Sepakati versi Next.js, TypeScript, package manager, UI library, dan aturan lint/format.
- [ ] Buat tiga aplikasi sesuai struktur repo: `hospital-web`, `bpjs-web`, `insurer-web`.
- [ ] Sepakati desain token warna, tipografi, spacing, ukuran komponen, dan perilaku responsive berdasarkan Figma.
- [ ] Dev 1 menetapkan kontrak komponen UI umum dan pola API client; Dev 2 dan Dev 3 mengikuti pola tersebut atau mengusulkan perubahan melalui diskusi.
- [ ] Pastikan endpoint tersedia di Swagger/OpenAPI atau koordinasikan mock response dengan backend sebelum integrasi.

### Git workflow

- Gunakan branch fitur:
  - `feat/dev1-hospital-foundation`
  - `feat/dev2-hospital-case-workflow`
  - `feat/dev3-payer-portals`
- Commit kecil dan deskriptif, misalnya `feat(hospital): add patient directory`.
- Jangan commit `.env.local`, token, atau credential.
- Lakukan pull/rebase dari branch utama secara berkala.
- Hindari mengedit file yang menjadi kepemilikan developer lain. Jika perlu, koordinasikan sebelum perubahan.
- Setiap PR harus menjelaskan halaman/fitur, endpoint yang digunakan, cara menguji, dan screenshot bila ada perubahan UI.

### Aturan koordinasi

| Kebutuhan | Penanggung jawab |
|---|---|
| Layout, komponen UI umum, autentikasi Hospital | Dev 1 |
| Halaman dan komponen kasus Hospital | Dev 2 |
| Portal BPJS dan Asuransi Swasta | Dev 3 |
| Perubahan kontrak API/backend | Koordinasi dengan backend sebelum implementasi |
| Perubahan komponen bersama | Dev 1 + developer pemakai |
| Pengujian alur CoB end-to-end | Ketiga developer bersama backend |

## 7. Urutan pengerjaan dan dependensi

```text
                 FOUNDATION
       Dev 1: setup hospital-web + UI kit
                    |
          +---------+----------+
          |                    |
          v                    v
 Dev 1: Auth, Dashboard,   Dev 2: Case workflow,
        Patient            Documents, Split Bill,
          |                Submission, Invoice,
          |                Payments
          |                    |
          +---------+----------+
                    |
                    v
        Integrasi Hospital Workspace
                    ^
                    |
       Dev 3: BPJS + Insurer portals
                    |
                    v
          Integrasi keputusan klaim
                    |
                    v
          E2E CoB / Non-CoB Testing
```

**Dependensi yang perlu diperhatikan:**
- Dev 2 dapat mulai membuat halaman menggunakan mock data setelah struktur route dan komponen dasar disepakati; integrasi API dilakukan ketika kontrak endpoint tersedia.
- Dev 3 dapat mengembangkan kedua portal secara paralel dengan mock payload `ClaimBundle` dan `ClaimResponseBundle`.
- Integrasi lintas portal baru dianggap selesai ketika keputusan dari BPJS/asuransi diterima backend dan statusnya dapat dibaca kembali oleh Hospital Workspace.

## 8. Definition of Done (DoD)

Sebuah halaman/fitur dinyatakan selesai jika:

- [ ] Tampilan mengikuti rancangan UI/UX dan konsisten dengan komponen proyek.
- [ ] Layout dapat digunakan pada ukuran layar target dan tidak mengalami overflow yang mengganggu.
- [ ] Loading, empty state, error state, dan success feedback tersedia.
- [ ] Form memiliki validasi input dan menampilkan error backend secara tepat.
- [ ] Data berasal dari API (atau mock yang secara eksplisit diberi label selama backend belum tersedia).
- [ ] Tombol, filter, pagination, modal, dan navigasi berfungsi; tidak ada kontrol dekoratif yang seolah-olah aktif.
- [ ] Tidak ada token, password, atau `.env` yang masuk ke Git.
- [ ] Build dan lint aplikasi terkait berhasil.
- [ ] PR telah direview dan tidak menimbulkan konflik dengan domain developer lain.

## 9. Checklist pengujian end-to-end

- [ ] **CoB normal:** login RS → registrasi pasien BPJS + swasta → buat kasus → upload dokumen → hitung dan terapkan split bill → ajukan klaim → BPJS menyetujui → asuransi menyetujui → RS menerima status → catat pembayaran → kasus lunas.
- [ ] **Revisi dokumen:** penjamin meminta revisi → notifikasi muncul di RS → RS upload dokumen revisi dan resubmit → penjamin memutuskan ulang.
- [ ] **Non-CoB:** buat kasus dengan mode `NON_COB` → hanya subklaim BPJS yang diajukan → tidak ada alokasi klaim swasta.
- [ ] **Validasi pembayaran:** nominal pembayaran yang melebihi sisa tagihan ditolak dan pesan error tampil pada form.
- [ ] **Akses:** pengguna tidak dapat membuka halaman portal atau role yang tidak sesuai tanpa autentikasi.

---

## Catatan

Pembagian ini merupakan pembagian **kepemilikan domain**, bukan pembagian jumlah frame yang harus sama persis. Dev 1 memiliki pekerjaan fondasi yang menjadi dependensi dua developer lain; Dev 2 berfokus pada alur kasus Hospital; Dev 3 mengerjakan dua portal penjamin dengan pola interaksi yang saling berkaitan. Estimasi beban perlu dievaluasi kembali setelah seluruh frame Figma dan kontrak API dipetakan satu per satu.
