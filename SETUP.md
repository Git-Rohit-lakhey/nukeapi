# NukeAPI v2 — Setup (lightweight)

Same steps as v1 `SETUP.md`, but lighter.

## 1. Install

```bash
npm install
cp .env.local.example .env.local   # then fill every value
```

Deps are 12, not 22 — install should be <60s.

## 2. Environment

All vars in `.env.local.example`. Critical (server-only, never client):

- `CREDENTIALS_ENCRYPTION_KEY` — `openssl rand -base64 32`
- `AUDIT_SIGNING_SECRET` — `openssl rand -hex 32`
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard
- `UPSTASH_REDIS_REST_URL` / `TOKEN` — rate limiting (required in prod, §6.8)
- `DODO_PAYMENTS_*` — billing (test_mode base `https://test.dodopayments.com`)

## 3. Database

Apply `supabase/migrations/` 001→011 **in order** via Supabase SQL editor or CLI. They create tables, RLS, `increment_usage()` RPC, `user_id_by_email()`, the owner-controlled `connector_flags` table (010: 6 live + 72 catalog), and trial support (011: `trialing` status + `trial_ends_at`).

## 4. Develop

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # 0 errors
npm run lint       # 0 errors
npm run test:integration
npm run build
```

## 5. Verify

`npm run test:integration` is 9 cases: crypto+tamper, signing+tamper, api-key determinism, SQL identifier injection, orchestrator partial/skip/complete/failed, compliance caps.

## 6. Deploy

- `vercel.json` cron `/api/cron/keepalive`
- Connect Git to Vercel, set env vars
- Dodo webhook: `/api/webhooks/dodo` (Standard Webhooks)

## 7. Next phases

ROADMAP Phase 7 (dashboard) and Phase 10 (marketing/legal) are stubs that build but need UI flesh-out. See `Universal Harness/ROADMAP.md`.
