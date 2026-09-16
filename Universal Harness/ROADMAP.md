# NukeAPI — Roadmap

Phases are sequential, each has a testable exit condition. Deferred work is listed explicitly so scope creep has nowhere to hide. This roadmap replaces the generic mobile-calling template with the exact build order from CLAUDE.md §11, made testable.

---

## Phase 0 — Scaffold (half a day)

- [ ] `npx create-next-app@latest` (TypeScript, App Router), copy folder structure from CLAUDE.md §3
- [ ] `.env.local.example`, `tsconfig.json`, `eslint.config.mjs`, `vercel.json` (keepalive cron), `app/globals.css` (dark/lime dev aesthetic)
- [ ] Empty routes respond: `GET /api/health` 200, `/` renders hero placeholder
- [ ] `lib/constants/compliance.ts` seeded (single source of truth — plan slugs, prices, overage, LEGAL, SUB_PROCESSORS)

Exit condition: `npm run typecheck` 0 errors, `npm run lint` 0 errors, `npm run build` succeeds, `GET /api/health` returns 200 on `npm run dev`.

## Phase 1 — Database + Migrations (1 day)

- [ ] Write migrations 001–009 in order (001 api_keys with key_lookup_hash, 002 deletion_requests, 003 audit_logs, 004 connector_credentials, 005 feedback, 006 keepalive, 007 subscriptions with correct CHECK constraint, 008 usage_meters + increment_usage() RPC, 009 fixes/indices + user_id_by_email)
- [ ] Apply to Supabase via SQL editor / CLI, verify RLS policies

Exit condition: all 9 migrations apply clean on a fresh Supabase project; `\d api_keys`, `\d subscriptions`, `SELECT * FROM pg_proc WHERE proname='increment_usage'` all return expected shapes; `npx tsc --noEmit` still 0.

## Phase 2 — Auth + API Keys (1 day)

- [ ] `lib/auth/keys.ts` (generateApiKey + hashApiKey with bcrypt + key_lookup_hash), `lib/auth/middleware.ts` (indexed SHA-256 lookup, then bcrypt.compare — never full scan)
- [ ] `lib/db/supabase.ts` (lazy supabaseAdmin), `lib/db/browser.ts`, `lib/hooks/useUser.ts`
- [ ] `(auth)` pages: login, signup, reset-password, update-password (Supabase Auth)
- [ ] `POST /api/v1/keys/create` (session-auth, stores key_lookup_hash)

Exit condition: signup → login → create API key (raw shown once) → `SELECT key_lookup_hash` indexed lookup works; `npm run test:integration` key-hash determinism passes.

## Phase 3 — Security Primitives (half a day)

- [ ] `lib/security/crypto.ts` (AES-256-GCM encryptJSON/decryptJSON, envelope {v,iv,tag,data}, server-only key)
- [ ] `lib/security/signing.ts` (canonicalize + signAudit/verifyAudit HMAC-SHA256, timingSafeEqual)

Exit condition: `test:integration` encryption round-trip + tamper detection + signing round-trip + tamper rejection all pass (5+ cases).

## Phase 4 — Connectors Engine (1–2 days)

- [ ] `lib/connectors/fetchHelper.ts` first (fetchWithTimeout 10s, fetchWithRetry 2 retries, retry only 429/5xx/network — never 4xx, parseJsonSafe)
- [ ] `lib/connectors/engine/{types,interp,http,sql,util}` — declarative HTTP/SQL engine with response.ok checks (§6.10), pagination (§6.11), identifier validation (§6.14)
- [ ] Specs for 6 connectors: stripe, mailchimp, hubspot, intercom, supabase, postgresql (latter identifier-validated; registered but safe)
- [ ] `lib/connectors/meta.ts` (6 entries, fields + required), `lib/connectors/index.ts` (registry), `types/connector.ts` (Integration union = 6)

Exit condition: `test:integration` SQL-identifier validator rejects `"; DROP TABLE` and "`users; --`"; `lib/connectors/index.ts` exports exactly 6 registered integrations; `typecheck` 0.

## Phase 5 — Orchestrator + delete-user Route (1 day)

- [ ] `lib/engine/orchestrator.ts` (Promise.allSettled, per-connector try/catch, audit-log inner try/catch §6.16, deriveStatus)
- [ ] `lib/audit/logger.ts` (writeAuditLogs, updateDeletionRequest)
- [ ] `app/api/v1/delete-user/route.ts` per §7: auth → rateLimit → usage/plan → body validate → insert pending → runDeletion → persist + sign → incrementUsage (only non-failed, failure preserved) → respond (success/hard fail honest §6.15, 200/207/500)

Exit condition: `POST /api/v1/delete-user` with Bearer key returns real per-integration results; `test:integration` orchestrator partial-failure handling (missing creds → skipped, one failed + one success → partial, logging hiccup → results preserved) 3/3 pass.

## Phase 6 — Metering + Rate Limiting (half a day)

- [ ] `lib/engine/ratelimit.ts` (Upstash Redis pipeline incr+expire, fail-open with warning §6.8)
- [ ] `lib/engine/metering.ts` (getPlanForUser, checkPlanLimit, incrementUsage via rpc increment_usage §6.7, buildUsageInfo)
- [ ] `lib/engine/errors.ts` (withErrorHandler wrapper if needed)

Exit condition: two concurrent `POST /api/v1/delete-user` for same user increment atomically (no duplicate row / undercount); rate limit 61st request in 60s returns 429; without Redis env, requests pass with a logged warning (fail open).

## Phase 7 — Dashboard (1 day)

- [ ] `(dashboard)/layout.tsx` (auth-gated shell), `dashboard/page.tsx` (usage stats), `connectors/page.tsx` (POSTs to /api/v1/connectors/save, never writes credentials directly), `keys/page.tsx`, `requests/page.tsx`, `settings/page.tsx` (cancel calls Dodo for real §6.12), `support/page.tsx`, `owner/page.tsx` (email-allowlisted)

Exit condition: logged-in user can connect Stripe creds → stored as encrypted envelope (verify via DB `SELECT credentials` is JSON with `v,iv,tag,data` not plaintext); can create/revoke key; can view requests; cancel calls Dodo API and only then marks local row cancelled.

## Phase 8 — Billing (half a day)

- [ ] `lib/billing/dodo.ts` (getDodoBaseUrl test/live, createCheckoutSession, cancelSubscription PATCH §6.12)
- [ ] `app/api/checkout/route.ts`, `app/api/webhooks/dodo/route.ts` (Standard Webhooks HMAC scheme §6.3, fail closed if secret missing, paginated user lookup §6.5, check every DB write error)
- [ ] `app/api/v1/subscription/cancel/route.ts`, `app/api/v1/account/delete/route.ts`

Exit condition: checkout session creates real Dodo URL in test_mode; webhook with missing secret returns 503 (not accepted); webhook with invalid signature returns 401; valid webhook activates plan and logs error if DB write fails (does not return success when DB failed).

## Phase 9 — PDF Audit Trail (half a day)

- [ ] `lib/audit/pdf.ts` (pdf-lib, signed footer with HMAC, verifiable)
- [ ] `app/api/requests/[id]/pdf/route.ts` (session-auth, ownership check, streams PDF)

Exit condition: after a deletion, `GET /api/requests/{id}/pdf` returns `application/pdf` whose footer contains the same `auditSignature` as the `deletion_requests` row and as the JSON response; `verifyAudit(canonicalize(subject), pdfSignature)` is true.

## Phase 10 — Marketing + Legal Pages (half a day)

- [ ] `app/page.tsx` (hero, 6 integrations, code example uses integrations available on free tier §5, compliance table from LEGAL, pricing table from PLANS, FAQ)
- [ ] `app/status/page.tsx` (live health checks via /api/health + /api/status)
- [ ] `app/terms`, `privacy`, `dpa` (sub-processor table from SUB_PROCESSORS single source), `refund`, `contact`, `blog` (one real post)

Exit condition: homepage code example integrations ⊆ `FREE_INTEGRATIONS`; legal figures on every page match `LEGAL` object exactly (GDPR €20M/4% whichever higher, CCPA $7,500/45d, LGPD note); DPA sub-processor list equals Privacy Policy list (same SUB_PROCESSORS array).

## Phase 11 — Test Suite + Final Pass (half a day)

- [ ] `test/integration.test.ts` covering: encryption round-trip + tamper, signing + tamper, api-key fast-hash determinism, SQL identifier injection rejects, orchestrator partial-failure (§6.16)
- [ ] `npm run typecheck` 0, `npm run lint` 0, `npm run test:integration` all pass, `npm run build` 0

Exit condition: `npx tsc --noEmit` ✓ · `npx eslint .` ✓ · `npm run test:integration` ✓ · `npx next build` ✓ — then walk CLAUDE.md §6.1–6.16 checklist and confirm each item is implemented, not just commented.

## Phase 12 — Deferred (post-v1, explicitly NOT this build)

- 78-connector catalog expansion (prove 6, then grow)
- Heavy SDKs (aws-sdk, gcs, vercelblob, cassandra-driver, mongodb, braintree, samlify)
- SSO/SAML (Enterprise)
- SOC 2 export + white-label PDFs
- Slack/webhook fleet
- Custom HTTP connectors (Enterprise)
- Mobile SDK / n8n node / MCP server (re-add after core is stable, lightweight)

## How to use this template

1. Do NOT skip a phase's exit condition — a skipped verification is how the failed v1 shipped half-built features as "done".
2. After each phase: `npm run typecheck` + `npm run lint` + fix before next phase.
3. Keep deferred work listed — that's how you say no to scope creep without forgetting it.
