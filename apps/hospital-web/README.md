# Hospital Workspace (`apps/hospital-web`)

Frontend Next.js + TypeScript untuk portal **Hospital Workspace** pada platform **KAPJ Flow**.

## Menjalankan Secara Lokal

```bash
pnpm install
pnpm dev
```

Aplikasi berjalan di `http://localhost:3001` dan terhubung ke Hospital Backend API (`http://localhost:8081`) melalui `NEXT_PUBLIC_API_BASE_URL` di `.env.local`.

## Struktur Direktori Saat Ini

```text
apps/hospital-web/
├── app/
│   ├── (auth)/login/          # Halaman login Hospital Workspace
│   ├── (hospital)/cases/      # Daftar, pembuatan, dan detail kasus
│   ├── (hospital)/claims/     # Antrean koordinasi klaim
│   ├── (hospital)/payments/   # Pembayaran dan rekonsiliasi
│   ├── (hospital)/notifications/ # Notifikasi penjamin
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Redirect ke /login
├── components/
│   ├── case/                  # Form dan alur kerja kasus CoB
│   ├── payment/               # Ringkasan pembayaran lintas kasus
│   └── ui/                    # Komponen UI dasar (Button, Modal, Toast)
├── lib/
│   ├── api/                   # API client terpusat, auth, dan case workflows
│   ├── auth/                  # Penyimpanan token & sesi login
│   └── utils/                 # Helper cn
└── types/                     # Kontrak TypeScript (api, auth, case)
```

## Hospital Case Workflow

Setelah login, menu **Kasus Perawatan** membuka daftar kasus dari API. Buat kasus
dari pasien terdaftar, lalu gunakan tab detail untuk mengelola dokumen (PDF/JPG/PNG,
maksimum 10 MB), menghitung dan menerapkan split bill, mengajukan atau mengirim
ulang subklaim, berkomunikasi dengan penjamin, serta melihat invoice dan mencatat
pembayaran. Menu **Koordinasi Klaim**, **Pembayaran**, dan **Notifikasi** menyediakan
antrean lintas kasus dan rekonsiliasi.

Validasi kesiapan pengajuan, status klaim, nominal alokasi, dan saldo pembayaran
tetap berasal dari backend. Mode `NON_COB` menonaktifkan alokasi asuransi swasta.

Pemeriksaan lokal:

```bash
pnpm run typecheck
pnpm run build
```
