# Private Insurer Portal

Next.js adjudicator portal for private-insurance secondary CoB claims.

## Run locally

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

The portal runs at `http://localhost:3003` and uses `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:8083`). The authenticated profile supplies the insurer entity and authority information. The login screen can fill the documented sandbox account for local testing.

## Included workflows

- Sign in, retrieve the current adjudicator profile, and protect reviewer routes.
- Load dashboard metrics, recent secondary claims, policy parameters, and activity.
- Search and paginate claims, and filter by claim status.
- Review policy, clinical, financial, and document snapshots.
- Request a backend adjudication preview for non-covered deductions, review its recommended approval and patient-excess impact, then submit a confirmed decision.
