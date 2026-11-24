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
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Redirect ke /login
├── components/
│   └── ui/                    # Komponen UI dasar (Button, Modal, Toast)
├── lib/
│   ├── api/                   # API client terpusat & auth endpoints
│   ├── auth/                  # Penyimpanan token & sesi login
│   └── utils/                 # Helper cn
└── types/                     # Kontrak TypeScript (api, auth)
```
