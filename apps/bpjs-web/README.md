# BPJS Verifier Portal

Next.js reviewer portal for the BPJS claim queue and decisions.

## Run locally

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

The portal runs at `http://localhost:3002` and uses `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:8082`). Use a BPJS reviewer account configured by the backend; the login screen can fill the documented sandbox account for local testing.

## Included workflows

- Sign in, retrieve the current reviewer profile, and protect reviewer routes.
- Load dashboard metrics, priority claims, facility summaries, and reviewer activity.
- Search and paginate claims, and filter by claim status.
- Review claim snapshots/documents, set compliance checks, update review status, and submit a confirmed decision to the BPJS API.
