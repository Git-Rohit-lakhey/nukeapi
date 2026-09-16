# NukeAPI — Master Build Specification

Paste this entire document as your first prompt to Claude Code in a fresh
project directory. It contains everything needed to build the product in
one pass: what it is, exact tech stack, complete folder structure, every
API contract, database schema, pricing, legal copy figures, and a
security checklist built from a prior audit's real findings — so these
specific mistakes aren't repeated.

---

## 0. Instructions to the coding agent

Act as a senior full-stack engineer, security engineer, and DevOps
engineer simultaneously. Build this as a production-grade SaaS, not a
prototype — every third-party call needs error handling, every
credential needs encryption, every financial action needs to actually
call the payment provider (not just update a local flag). Work through
the phases in Section 11 in order. After each phase, run
`npx tsc --noEmit` and `npx eslint .` and fix anything they flag before
moving to the next phase. Do not mark anything "done" without actually
running it.

If anything in this spec is ambiguous, prefer the more secure, more
correct, more explicit option over the simpler one — this product's
entire value proposition is "trust us to handle this correctly."

---

## 1. What this product is

**NukeAPI** is a GDPR/CCPA/LGPD user-deletion API. A developer sends one
authenticated API call with a user's email; NukeAPI fans that request
out in parallel across the third-party services that company uses
(Stripe, Mailchimp, HubSpot, Intercom, Supabase, and — later — a direct
Postgres connector), deletes that user's data in each one, and returns a
structured result plus a cryptographically signed PDF audit trail
proving what happened, when, and for whom. It solves "we got a GDPR
Article 17 erasure request and now have to manually delete this person
from 5 different tools" for small-to-mid SaaS companies who can't afford
enterprise privacy platforms (OneTrust, Transcend, etc.) and don't want
to build this themselves.

**Positioning:** developer-first, self-serve, transparent usage-based
pricing — not a sales-led enterprise compliance platform. The buyer is a
solo founder, a small dev team, or an agency building this into client
apps, not a dedicated privacy team.

**Core promise, and what must actually back it (not just marketing copy):**
- "One API call deletes a user everywhere" → real parallel calls to
  each connector's real delete endpoint, with genuine per-integration
  success/failure/skip status, not a simulated response.
- "Signed PDF audit trail" → an actual HMAC-SHA256 (or stronger)
  cryptographic signature over the result, embedded in the PDF and
  independently re-verifiable — not just an official-looking document.
- "AES-256 encrypted at rest" → connector credentials (Stripe secret
  keys, CRM tokens, Supabase service role keys) genuinely encrypted
  server-side before they ever reach the database — never written as
  plaintext from the browser.
- "Retry with backoff" → real exponential-backoff retry logic on
  transient failures (timeouts, 5xx, 429), not aspirational copy.
- "Cancel anytime" → cancelling in the dashboard must actually call the
  payment provider's cancel API, not just flip a local database flag.

---

## 2. Tech stack

- **Framework:** Next.js 15 (App Router), TypeScript, deployed on Vercel
  (serverless functions — design every hot-path accordingly, e.g. no
  in-memory state that needs to persist across requests)
- **Database / Auth:** Supabase (Postgres + built-in auth + Row Level
  Security). Use the anon client from the browser for anything
  RLS-appropriate; use the service-role client (`supabaseAdmin`) only in
  server-side code, never exposed to the client.
- **Payments:** Dodo Payments (checkout sessions + subscriptions +
  webhooks). Test-mode base URL: `https://test.dodopayments.com`.
  Live-mode base URL: `https://live.dodopayments.com` — **do not** use
  `api.dodopayments.com`, that is not a real Dodo host.
- **Rate limiting:** Upstash Redis (REST API, `@upstash/redis`) —
  required because this deploys as serverless functions across multiple
  ephemeral instances; an in-memory counter will not work correctly in
  production and must not be used for anything security- or
  billing-relevant.
- **Email:** Resend, for transactional notifications.
- **PDF generation:** `pdf-lib`.
- **Styling:** plain CSS-in-JS inline styles or Tailwind — dark theme,
  lime-green (`#c8ff00`-ish) accent color, monospace-adjacent developer
  aesthetic (this is a dev-tool product, not consumer SaaS).
- **Package manager:** npm.

---

## 3. Complete folder structure

```
nukeapi/
├── app/
│   ├── page.tsx                          # Homepage — hero, features, integrations, pricing, FAQ
│   ├── layout.tsx
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── update-password/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Auth-gated shell, nav, sign out
│   │   ├── dashboard/page.tsx            # Usage stats, recent activity, success rate
│   │   ├── connectors/page.tsx           # Connect/manage Stripe/Mailchimp/HubSpot/Intercom/Supabase
│   │   ├── keys/page.tsx                 # API key create/revoke, shown once on creation
│   │   ├── requests/page.tsx             # Deletion request history + per-integration audit log detail
│   │   ├── settings/page.tsx             # Plan, billing, upgrade/downgrade, cancel
│   │   ├── support/page.tsx              # Bug/feedback report form
│   │   └── owner/page.tsx                # Internal-only: MRR, subscribers, error logs (email-allowlisted)
│   ├── api/
│   │   ├── v1/
│   │   │   ├── delete-user/route.ts      # THE core endpoint — POST, API-key authenticated
│   │   │   ├── keys/create/route.ts
│   │   │   ├── connectors/save/route.ts  # Server-side credential encryption + storage
│   │   │   ├── account/delete/route.ts   # Self-service full account deletion
│   │   │   └── subscription/cancel/route.ts
│   │   ├── checkout/route.ts             # Creates a Dodo checkout session
│   │   ├── webhooks/dodo/route.ts        # Dodo billing events
│   │   ├── cron/keepalive/route.ts       # Supabase free-tier keepalive ping
│   │   ├── debug/route.ts                # Gated admin/debug endpoint, OFF by default
│   │   ├── health/route.ts
│   │   └── feedback/route.ts
│   ├── status/page.tsx                   # Public status page — live health checks
│   ├── blog/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   ├── terms/page.tsx
│   ├── privacy/page.tsx
│   ├── dpa/page.tsx
│   ├── refund/page.tsx
│   └── contact/page.tsx
├── lib/
│   ├── connectors/
│   │   ├── index.ts                      # CONNECTORS registry (name → delete function)
│   │   ├── fetchHelper.ts                # Shared timeout + retry-with-backoff wrapper
│   │   ├── stripe.ts
│   │   ├── mailchimp.ts
│   │   ├── hubspot.ts
│   │   ├── intercom.ts
│   │   ├── supabase.ts
│   │   └── postgresql.ts                 # Phase 2 — not registered in index.ts yet, but built safely from day 1
│   ├── engine/
│   │   ├── orchestrator.ts               # Parallel connector execution, partial-failure handling, signing
│   │   ├── ratelimit.ts                  # Redis-backed
│   │   ├── metering.ts                   # Usage tracking + plan limit enforcement
│   │   └── errors.ts                     # Central error handler + withErrorHandler wrapper
│   ├── security/
│   │   ├── crypto.ts                     # AES-256-GCM credential encryption
│   │   └── signing.ts                    # HMAC-SHA256 audit signature
│   ├── auth/
│   │   ├── keys.ts                       # API key generation (raw + bcrypt hash + fast lookup hash)
│   │   └── middleware.ts                 # API key validation for /api/v1/* routes
│   ├── billing/
│   │   └── dodo.ts                       # Checkout session creation + cancelSubscription()
│   ├── audit/
│   │   ├── pdf.ts                        # Signed PDF generation
│   │   └── logger.ts                     # Writes to audit_logs table
│   ├── db/
│   │   ├── supabase.ts                   # Lazy server-side admin + non-admin clients
│   │   └── browser.ts                    # Client-component Supabase client
│   ├── hooks/
│   │   └── useUser.ts
│   └── constants/
│       └── compliance.ts                 # SINGLE SOURCE OF TRUTH for plan limits, prices, overage rates, legal figures
├── types/
│   ├── connector.ts
│   ├── deletion.ts
│   └── api.ts
├── supabase/
│   └── migrations/
│       ├── 001_api_keys.sql
│       ├── 002_deletion_requests.sql
│       ├── 003_audit_logs.sql
│       ├── 004_connector_credentials.sql
│       ├── 005_feedback.sql
│       ├── 006_keepalive.sql
│       ├── 007_subscriptions.sql
│       ├── 008_usage_metering.sql
│       └── 009_fixes_and_hardening.sql   # See Section 6 — bake these fixes in from the start
├── test/
│   └── integration.test.ts               # Mock-server test: encryption, signing, SQL-injection guard, partial-failure logic
├── .env.local.example
├── SETUP.md
├── package.json
├── tsconfig.json
└── vercel.json
```

---

## 4. Database schema (all tables)

Write these as sequential migration files. Every table with a `user_id`
column gets `references auth.users(id) on delete cascade` and a Row
Level Security policy scoping access to `auth.uid() = user_id`, unless
noted otherwise.

**`api_keys`**
```sql
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,
name text not null,
key_hash text not null,              -- bcrypt hash, cost factor 10+
key_prefix text not null,            -- first ~12 chars of the raw key, for display ("nk_live_ab3f...")
key_lookup_hash text unique,         -- deterministic SHA-256 of the raw key — REQUIRED for fast auth lookup, see Section 6.4
is_active boolean not null default true,
expires_at timestamptz,
last_used_at timestamptz,
created_at timestamptz not null default now()
```
Index on `key_lookup_hash` (unique, partial `where key_lookup_hash is not null`).

**`deletion_requests`**
```sql
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,
api_key_id uuid references api_keys(id),
subject_email text not null,
subject_external_id text,
integrations_requested text[] not null,
integrations_completed text[],
integrations_failed text[],
status text not null check (status in ('pending','completed','partial','failed')),
audit_signature text,                -- HMAC-SHA256 over the result, see Section 6.6
created_at timestamptz not null default now(),
completed_at timestamptz
```

**`audit_logs`**
```sql
id uuid primary key default gen_random_uuid(),
deletion_request_id uuid not null references deletion_requests(id) on delete cascade,
integration text not null,
status text not null check (status in ('success','failed','skipped')),
message text,
error_detail text,
duration_ms integer,
created_at timestamptz not null default now()
```

**`connector_credentials`**
```sql
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,
integration text not null,
credentials jsonb not null,          -- ENCRYPTED envelope {v,iv,tag,data} — see Section 6.1, never plaintext
is_active boolean not null default true,
updated_at timestamptz not null default now(),
unique(user_id, integration)
```

**`feedback`** — user_id, message, created_at. Simple bug/feedback reports.

**`keepalive_log`** — timestamp, status. Just for the cron keepalive ping.

**`subscriptions`**
```sql
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade unique,
plan text not null check (plan in (
  'free','startup','startup_yearly','business','business_yearly','enterprise','enterprise_yearly'
)),                                   -- MUST match the plan slugs used everywhere else in the app — see Section 6.2
status text not null check (status in ('active','cancelled','past_due')),
external_subscription_id text,        -- Dodo's subscription ID — required to actually cancel later
current_period_start timestamptz,
current_period_end timestamptz,
cancelled_at timestamptz,
updated_at timestamptz not null default now()
```

**`usage_meters`**
```sql
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,
period_start date not null,
period_end date not null,
deletion_count integer not null default 0,
updated_at timestamptz not null default now(),
unique(user_id, period_start)
```

**Postgres function `increment_usage`** (required — see Section 6.7 for why):
```sql
create or replace function increment_usage(
  p_user_id uuid, p_period_start timestamptz, p_period_end timestamptz
) returns void language plpgsql security definer as $$
begin
  insert into usage_meters (user_id, period_start, period_end, deletion_count)
  values (p_user_id, p_period_start, p_period_end, 1)
  on conflict (user_id, period_start)
  do update set deletion_count = usage_meters.deletion_count + 1, updated_at = now();
end;
$$;
```

Do **not** create a separate `plan_limits` table. Plan limits live in
exactly one place: `lib/constants/compliance.ts`. A second, DB-level
source of truth for the same numbers will drift and contradict the
first one.

---

## 5. Pricing (exact figures — keep consistent everywhere: pricing page, `compliance.ts`, Terms, checkout, DB constraint)

| Tier | Price | Included deletions/mo | Integrations | Overage |
|---|---|---|---|---|
| Sandbox (free) | $0 | 20 | 3 of 5 (not 2 — must match whatever integrations the homepage's own code example uses, or a free user's first copy-pasted call fails) | — |
| Startup | $99/mo ($990/yr) | 200 | All 5 | $0.50/deletion |
| Business | $299/mo ($2,990/yr) | 1,000 | All + custom | $0.35/deletion (must stay *above* the blended included rate of ~$0.30/deletion — an overage rate cheaper than the plan's own blended rate creates a perverse incentive to never upgrade) |
| Enterprise | $699/mo ($6,990/yr) | Unlimited | Custom connectors, SSO, SOC 2 export, dedicated SLA | — |

Annual billing = 2 months free (10x monthly price for 12 months).

Legal figures to use consistently everywhere they appear (pricing page,
Terms, DPA, compliance table) — do not understate them in some places
and not others:
- GDPR: up to €20M **or 4% of global annual revenue, whichever is higher** — always include the revenue qualifier, not just the flat figure
- CCPA/CPRA: up to $7,500 per violation; response deadline 45 days (extendable)
- LGPD: cite the specific response-timeframe claim carefully; note it varies by request type — don't overstate a single blanket number

---

## 6. Security & correctness requirements (baked in from day one)

These are not "nice to haves" — they were all real bugs found in a prior
build of this exact product. Build it correctly the first time instead
of retrofitting these.

**6.1 — Credential encryption is mandatory, server-side only.**
Connector credentials (Stripe secret keys, HubSpot/Intercom tokens,
Supabase service role keys) must NEVER be written to the database as
plaintext, and must NEVER be encrypted client-side (the key can't be
trusted in the browser). Flow: the connectors dashboard page POSTs
credentials to a server route (`/api/v1/connectors/save`) over an
authenticated session; that route encrypts with AES-256-GCM using a
server-only `CREDENTIALS_ENCRYPTION_KEY` env var before writing to
Postgres. The orchestrator decrypts server-side when it needs to use
them. The browser must never write directly to the
`connector_credentials` table, even though RLS would technically scope
it correctly — the encryption key must never need to reach the client.

**6.2 — The `subscriptions.plan` CHECK constraint must match the real plan slugs used everywhere else**, including `_yearly` variants (`startup`, `startup_yearly`, `business`, `business_yearly`, `enterprise`, `enterprise_yearly`, `free`). A mismatch here (e.g. constraint allows `'starter'` but the webhook sends `'startup'`) silently rejects every real paying customer's plan upgrade at the database level, and the webhook handler must actually check for and surface this error rather than swallowing it.

**6.3 — Webhook signature verification must fail closed.** If the webhook secret env var is missing, reject all incoming webhook requests (503) — do not silently skip signature verification and accept unsigned payloads. Use the Standard Webhooks scheme (same as Svix): `HMAC-SHA256(secret, "{id}.{timestamp}.{body}")`, base64-encoded, compared with `timingSafeEqual`.

**6.4 — API key authentication must use a fast, indexed lookup — never a full-table scan.** bcrypt hashes are salted and non-deterministic, so a stored bcrypt hash can never be found by equality lookup. Store a second, deterministic `key_lookup_hash` (SHA-256 of the raw key) alongside the bcrypt hash. Auth flow: SHA-256 the incoming raw key → indexed lookup on `key_lookup_hash` to find the single candidate row → bcrypt.compare against just that row for final verification (defense in depth). Do not bcrypt-compare against every active key in the system on every request — that doesn't scale past a few hundred keys.

**6.5 — Webhook user lookup must be paginated**, not limited to the Admin API's default first page (typically 50 users). A customer beyond the first page must still be found and have their plan activated. Also: check and log/return the `error` from every database write in the webhook handler — a swallowed upsert error means a customer is charged but never upgraded, with the webhook still reporting success to the payment provider (so it never retries).

**6.6 — The PDF audit trail must be genuinely cryptographically signed**, not just formatted to look official. Compute an HMAC-SHA256 signature over a canonical representation of the deletion result (request ID, subject email, status, timestamps, sorted per-integration results) using a server-only `AUDIT_SIGNING_SECRET`. Store the signature on the `deletion_requests` row and embed it in the PDF footer, so it's independently re-verifiable later, not just decorative.

**6.7 — Usage metering increments must be atomic**, not read-then-write. Two deletion calls landing near-simultaneously for the same user must not be able to race into a duplicate row or an undercounted total. Use the `increment_usage()` Postgres function (Section 4) via `supabaseAdmin.rpc(...)`, not a SELECT-then-INSERT-or-UPDATE pattern in application code.

**6.8 — Rate limiting must use Upstash Redis**, not an in-memory Map. This app deploys as Vercel serverless functions across multiple ephemeral instances with no shared memory — an in-memory counter silently fails to enforce limits correctly under real concurrent traffic. Fail open (log a loud warning, don't block requests) only if Redis genuinely isn't configured, e.g. local dev.

**6.9 — Every connector must have a request timeout and retry-with-backoff.** Build a shared `fetchWithTimeout`/`fetchWithRetry` helper (10s timeout default, 2 retries with exponential backoff, retry only on 429/5xx/network errors — never on 4xx, since a bad request or bad auth won't succeed on retry) and use it in every connector's outbound calls. A hanging third-party API must not be able to hang the whole deletion request indefinitely.

**6.10 — Every connector must check `response.ok` before reading the body.** An invalid API key or auth failure returns an error JSON body with different shape than a success body — reading a field like `.lists` or `.data` off an unchecked error response yields `undefined`, which must not be silently interpreted as "no data found, skipping" (that hides real auth/config failures as false "nothing to delete" results — a compliance product must never confuse "we didn't check" with "we checked and there was nothing").

**6.11 — Connectors must paginate through all matching results**, not just the first page/default limit. If an email matches more than one Stripe customer (5 by default) or an account has more than 100 Mailchimp lists, all of them must be checked/deleted, not silently left incomplete.

**6.12 — Cancelling a subscription must actually call the payment provider's cancel API** (Dodo: `PATCH /subscriptions/{id}` with `cancel_at_next_billing_date: true`) and only update the local `subscriptions` row to `cancelled` if that call succeeds. Never mark a subscription cancelled locally, tell the customer they're done, and leave the actual billing subscription still active — that results in customers being charged after being told they'd cancelled.

**6.13 — Any admin/debug endpoint must be opt-in by default (fail closed), never opt-out.** E.g. `ENABLE_DEBUG_ENDPOINT=true` required to turn it on — not a `DISABLE_DEBUG_ENDPOINT=false` default that's live unless someone remembers to turn it off. A forgotten env var should always fail toward "disabled," never toward "enabled."

**6.14 — Any dormant/Phase-2 connector (e.g. direct PostgreSQL) must still be built safely even before it's wired into the registry.** If it accepts user-supplied table/column names, those are SQL identifiers and cannot be parameterized like values — validate them against a strict allowlist regex (`^[a-zA-Z_][a-zA-Z0-9_]{0,62}$`) before ever interpolating them into a query. Don't defer this "until it's actually enabled" — that's exactly how it ships forgotten.

**6.15 — API response `success` fields must reflect the real outcome**, not be hardcoded `true` regardless of what happened. If a deletion partially or fully failed, `success` in the JSON body must say so, consistent with the HTTP status code — don't make a client have to parse nested fields to discover a failure the top-level field denied.

**6.16 — The orchestrator must never silently drop a connector's result.** Run connectors in parallel via `Promise.allSettled`, with each connector call wrapped in its own try/catch so one failing can't crash the others. Critically: if the *error-logging call itself* throws inside that catch block, the connector's result must still be recorded as failed — wrap the error-logging call in its own inner try/catch so a logging hiccup can never cause a result to vanish entirely from the audit trail (a missing result is worse than a failed one for a compliance product).

---

## 7. Core API contract

**`POST /api/v1/delete-user`** — the main endpoint. Auth: `Authorization: Bearer nk_live_...`.

Request:
```json
{ "subject_email": "user@example.com", "integrations": ["stripe","mailchimp","hubspot"] }
```

Response (200 completed / 207 partial / 500 failed):
```json
{
  "success": true,
  "data": {
    "requestId": "...",
    "status": "completed",
    "results": [
      { "integration":"stripe", "status":"success", "message":"Deleted 1 Stripe customer(s)", "durationMs":420 }
    ],
    "startedAt":"...", "completedAt":"...", "elapsedMs":890,
    "auditSignature": "hex-hmac-sha256...",
    "usage": { "plan":"startup", "used":41, "limit":200, "remaining":159 }
  },
  "requestId": "..."
}
```
Flow inside the route: 1) validate API key (fast lookup, Section 6.4) →
2) check rate limit (Redis) → 3) check usage/plan limit → 4) validate
request body → 5) insert a `deletion_requests` row (`pending`) → 6) run
`orchestrator.runDeletion()` → 7) increment usage only on non-`failed`
outcomes, and don't let a metering failure hide an otherwise-successful
deletion result from the response → 8) return the result, optionally
generating and attaching a signed PDF if requested.

**Other routes:** `POST /api/v1/keys/create` (session-authenticated,
stores `key_lookup_hash`), `POST /api/v1/connectors/save`
(session-authenticated, encrypts before storing),
`POST /api/v1/subscription/cancel` (session-authenticated, calls Dodo —
Section 6.12), `POST /api/v1/account/delete` (self-service, cascades via
FK constraints), `POST /api/webhooks/dodo` (signature-verified —
Section 6.3), `GET /api/health`, `GET /api/status` (public, used by the
`/status` page).

---

## 8. Connectors — exact behavior per integration

Each connector exports a function `(email, config) => Promise<ConnectorResult>` where `ConnectorResult = { integration, status: 'success'|'failed'|'skipped', message, error?, durationMs }`.

- **Stripe** — search customers by email (paginate with `starting_after`), delete each matching customer via `DELETE /v1/customers/{id}`. Credentials: `secret_key`.
- **Mailchimp** — hash email as MD5 (Mailchimp's member-ID scheme), search all lists (paginate), call `POST /lists/{id}/members/{hash}/actions/delete-permanent` on each list containing the member. Credentials: `api_key`, `server_prefix`.
- **HubSpot** — `POST /crm/v3/objects/contacts/search` filtering by email, then `DELETE /crm/v3/objects/contacts/{id}` for each match. Credentials: `access_token`.
- **Intercom** — `POST /contacts/search` by email, then `DELETE /contacts/{id}` for each match. Credentials: `access_token`.
- **Supabase** (the customer's own Supabase project, not NukeAPI's) — `GET /auth/v1/admin/users?email=...`, then `DELETE /auth/v1/admin/users/{id}`. Credentials: `project_url`, `service_role_key`.
- **PostgreSQL** (Phase 2, built but not registered) — direct `DELETE FROM "{table}" WHERE "{email_column}" = $1`, with strict identifier validation per Section 6.14. Credentials: `connection_string`, `table_name`, `email_column`.

All five (six) share the `fetchHelper.ts` timeout/retry wrapper from Section 6.9.

---

## 9. Legal/marketing pages required

Terms, Privacy Policy, DPA (with a sub-processor table — must exactly
match the Privacy Policy's own sub-processor list, generated from one
shared source, not maintained by hand in two places), Refund Policy,
`/status` (live health checks), `/contact`, blog with at least one real
post ("How to Handle GDPR Right to Erasure Requests Automatically").
Homepage needs: hero, the 5-integration list, a code example (must use
integrations actually available on the free tier — see Section 5), a
compliance-deadline comparison table (GDPR/CCPA/LGPD), pricing table,
FAQ.

---

## 10. Environment variables (complete list)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=                          # openssl rand -hex 32
CREDENTIALS_ENCRYPTION_KEY=           # openssl rand -base64 32 — REQUIRED, see 6.1
AUDIT_SIGNING_SECRET=                 # openssl rand -hex 32 — REQUIRED, see 6.6
UPSTASH_REDIS_REST_URL=               # REQUIRED in production, see 6.8
UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=
DODO_PAYMENTS_API_KEY=
DODO_WEBHOOK_SECRET=
DODO_PAYMENTS_ENVIRONMENT=test_mode   # or live_mode — see Section 2 for correct base URLs per mode
DODO_PAYMENTS_RETURN_URL=
DODO_PRODUCT_STARTUP_MONTHLY=
DODO_PRODUCT_STARTUP_YEARLY=
DODO_PRODUCT_BUSINESS_MONTHLY=
DODO_PRODUCT_BUSINESS_YEARLY=
DODO_PRODUCT_ENTERPRISE_MONTHLY=
DODO_PRODUCT_ENTERPRISE_YEARLY=
ENABLE_DEBUG_ENDPOINT=false           # opt-in, see 6.13
```

---

## 11. Build order

1. **Scaffold** — Next.js + TypeScript project, folder structure from Section 3, `.env.local.example`, `tsconfig.json`, ESLint config.
2. **Database** — write and document all migrations from Section 4 in order, including the constraint/fast-lookup/atomic-increment details from Section 6.
3. **Auth + API keys** — signup/login pages, `lib/auth/keys.ts` (raw + bcrypt + fast lookup hash together, from the start), `lib/auth/middleware.ts` (indexed lookup, not full-table scan).
4. **Security primitives** — `lib/security/crypto.ts` and `lib/security/signing.ts` before anything that depends on them.
5. **Connectors** — `fetchHelper.ts` first, then all 5 (6) connectors per Section 8, registered in `lib/connectors/index.ts` (PostgreSQL stays unregistered but still built safely).
6. **Orchestrator + delete-user route** — per Sections 6.16 and 7.
7. **Metering + rate limiting** — Redis-backed rate limiter, atomic usage RPC.
8. **Dashboard** — connectors page (posts to the encrypted save route, never writes credentials directly), keys page, requests page, settings page (cancel flow calls Dodo for real), owner page.
9. **Billing** — Dodo checkout session creation + webhook handler (Section 6.3, 6.5) + cancelSubscription (Section 6.12).
10. **PDF audit trail** — signed, per Section 6.6.
11. **Marketing + legal pages** — Section 9, with the shared compliance-figures source from Section 6.1's sibling requirement (one source of truth file, `lib/constants/compliance.ts`).
12. **Test suite** — a mock-server integration test (no real third-party credentials) covering: encryption round-trip + tamper detection, signature sign/verify + tamper detection, API key fast-hash determinism, SQL-identifier-validator rejecting injection attempts, and orchestrator partial-failure handling. Add as `npm run test:integration`.
13. **Final pass** — `npx tsc --noEmit`, `npx eslint .`, `npm run test:integration`, `npx next build` — all must pass clean before considering this done. Then walk through Section 6 one more time as a checklist and confirm each item is actually implemented, not just mentioned in a comment.