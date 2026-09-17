# NukeAPI v2 — Lightweight, Modular, Scalable

> **One API call deletes a user everywhere** — GDPR/CCPA/LGPD, real parallel deletes, AES-256 encrypted vault, HMAC-signed PDF audit trail.

This is **v2** rebuilt from the failed v1 (`E:\Applications\nukeapi`). Same spec, fraction of the weight.

## What changed vs v1 (why v1 failed)

| v1 problem | v2 fix |
|---|---|
| 22 deps (aws-sdk, gcs, vercel/blob, cassandra, mongodb, braintree, samlify) inflated bundle & cold-start | **12 deps** — `next`, `react`, `supabase`, `upstash/redis`, `bcryptjs`, `pdf-lib`, `resend`, `zod`, `server-only`, `pg` |
| 16 migrations (010–016 for dormant features) never applied in prod | **9 migrations** exactly per spec §4 |
| `lib/connectors/_archive` duplicate + 78-connector meta bloat | **78-entry catalog** in `meta.ts` (6 live executors + 72 coming-soon) with owner-controlled `connector_flags` (migration 010), no heavy drivers |
| 1200-line `LandingPage.tsx` single client component | Slim `app/page.tsx` + `components/marketing/IntegrationsGrid.tsx` (28 → Show all 78 → Show less, ported from v1) |
| Trial/custom/SSO paths assumed tables that didn't exist | Removed from v1 — re-add only when ROADMAP phase starts |
| `buildUsageInfo` off-by-one, silent `profiles` email miss | Fixed to read *after* increment, no subtraction |

See `Universal Harness/DEEP_ANALYSIS.md` for the full audit.

## Quick start

```bash
cp .env.local.example .env.local   # fill all values
# apply supabase/migrations/ 001–011 to your Supabase project
npm install        # use the light package.json (12 deps) on your machine
npm run dev        # http://localhost:3000
npm run typecheck  # 0 errors
npm run lint       # 0 errors
npm run test:integration  # 9/9
npm run build      # 29 routes, ✓
```

## Project structure

Same as `CLAUDE.md` §3 (frozen). Key single sources:

- `lib/constants/compliance.ts` — plans, prices, LEGAL, SUB_PROCESSORS
- `lib/connectors/meta.ts` — 6 connector field defs
- `lib/connectors/index.ts` — runtime registry
- `lib/connectors/engine/` — universal HTTP/SQL engine (timeout/retry/response.ok/pagination/identifier validation)

## Harness

Discipline kit lives in `Universal Harness/`:

- `CLAUDE.md` — full master build spec (paste as prompt for fresh build)
- `ROADMAP.md` — 12 phases with testable exit conditions
- `TECH_STACK.md` — frozen stack + env vars
- `DESIGN_SYSTEM.md` — dark/lime monospace tokens
- `AGENTS.md` / `HARNESS.md` / `ROLES.md` — how you work every turn

## Current status (this session)

- Phase 0–6 **GREEN**: scaffold, migrations, auth, crypto/signing, 6 connectors, orchestrator + `POST /api/v1/delete-user`, metering/ratelimit, `test:integration` 9/9, `build` 29 routes.
- Stubs: dashboard pages, marketing sections, legal pages — build passes but need fleshing out (tracked in ROADMAP Phase 7/10).
- Deferred: SSO, SOC2, custom connectors, 72 extra integrations — intentionally not in v1.

## Live endpoints

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/v1/delete-user` | Bearer `nk_live_…` |
| `POST` | `/api/v1/keys/create` | session |
| `POST` | `/api/v1/connectors/save` | session (server-encrypted) |
| `POST` | `/api/checkout` | session |
| `POST` | `/api/webhooks/dodo` | Standard Webhooks HMAC |

Built by Lakhu Studio — spec §6's 16 security rules are the Definition of Done.
