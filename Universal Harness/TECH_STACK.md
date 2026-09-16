# NukeAPI — Tech Stack

Freeze these choices until ROADMAP.md says to change them. Mid-build drift (adding heavy SDKs "just in case") is the #1 source of bloat in the failed v1 — this doc prevents it.

## Frontend / Framework

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Required by spec §2, Vercel serverless native |
| Language | TypeScript, strict mode | Spec §2, catch connector/meta mismatches at build |
| Styling | Tailwind CSS (or minimal inline) | Dark theme, lime #c8ff00 accent, monospace dev aesthetic |
| Hosting | Vercel | Serverless functions, cron, edge — zero ops |
| Package manager | npm | Spec §2 |

## Backend / Services

| Layer | Choice | Why |
|---|---|---|
| Database / Auth | Supabase (Postgres + Auth + RLS) | Spec §2 — free tier, row-level security |
| Payments | Dodo Payments | Spec §2 — checkout + subscriptions + webhooks. Test: `https://test.dodopayments.com` / Live: `https://live.dodopayments.com` |
| Rate limiting | Upstash Redis (`@upstash/redis`) | Spec §6.8 — serverless-safe, REST API |
| Email | Resend | Transactional only |
| PDF | pdf-lib | Spec §2 — signed audit trail |
| Validation | zod | Lightweight schema validation |

## Explicitly NOT in v1 (prevents 10-dep bloat)

The failed v1 shipped these deps and never needed them for the 6 core connectors. They are **removed** in v2 — re-add only when a specific ROADMAP phase justifies them:

- No `@aws-sdk/*`, `@google-cloud/storage`, `@vercel/blob`, `cassandra-driver`, `mongodb`, `braintree`, `samlify`, `zod` heavy auth, `@libsql/client` (Turso) — unless a connector spec explicitly requires it
- Only `pg` is kept (Postgres direct connector, identifier-validated, §6.14) — `mysql2` deferred to post-v1
- No `supabase/ssr` split — single lazy `supabaseAdmin` + browser client is sufficient

## Environment variables

All variables documented in `.env.local.example` (source: Universal Harness/.env.local.example). Critical ones:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=                          # openssl rand -hex 32
CREDENTIALS_ENCRYPTION_KEY=           # openssl rand -base64 32 — REQUIRED (§6.1)
AUDIT_SIGNING_SECRET=                 # openssl rand -hex 32 — REQUIRED (§6.6)
UPSTASH_REDIS_REST_URL=               # REQUIRED in production (§6.8)
UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=
DODO_PAYMENTS_API_KEY=
DODO_WEBHOOK_SECRET=
DODO_PAYMENTS_ENVIRONMENT=test_mode   # or live_mode — see §2 URLs
DODO_PAYMENTS_RETURN_URL=
DODO_PRODUCT_STARTUP_MONTHLY=
DODO_PRODUCT_STARTUP_YEARLY=
DODO_PRODUCT_BUSINESS_MONTHLY=
DODO_PRODUCT_BUSINESS_YEARLY=
DODO_PRODUCT_ENTERPRISE_MONTHLY=
DODO_PRODUCT_ENTERPRISE_YEARLY=
ENABLE_DEBUG_ENDPOINT=false           # opt-in (§6.13)
OWNER_EMAILS=you@example.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Accounts you need before Phase 0 is done

- Supabase project (apply migrations 001–009)
- Upstash Redis database (REST URL + token)
- Dodo Payments account (test mode products for 3 tiers)
- Resend account (API key)
- Vercel project (connected to Git, env vars set)
- Domain (nukeapi.dev) + status page

## Folder structure

Adapted from CLAUDE.md §3 — frozen for v2. Do NOT introduce a parallel convention.

```
nukeapi_v2_latest/
├── Universal Harness/               # discipline kit (AGENTS, ROADMAP, TECH_STACK, DESIGN_SYSTEM, CLAUDE.md, SETUP.md)
├── app/
│   ├── page.tsx                     # Homepage — hero, integrations, code example, compliance table, pricing, FAQ
│   ├── layout.tsx
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── update-password/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── connectors/page.tsx
│   │   ├── keys/page.tsx
│   │   ├── requests/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── support/page.tsx
│   │   └── owner/page.tsx
│   ├── api/
│   │   ├── v1/
│   │   │   ├── delete-user/route.ts
│   │   │   ├── keys/create/route.ts
│   │   │   ├── connectors/save/route.ts
│   │   │   ├── account/delete/route.ts
│   │   │   └── subscription/cancel/route.ts
│   │   ├── checkout/route.ts
│   │   ├── webhooks/dodo/route.ts
│   │   ├── cron/keepalive/route.ts
│   │   ├── debug/route.ts
│   │   ├── health/route.ts
│   │   └── feedback/route.ts
│   ├── status/page.tsx
│   ├── blog/page.tsx + [slug]/page.tsx
│   ├── terms/page.tsx
│   ├── privacy/page.tsx
│   ├── dpa/page.tsx
│   ├── refund/page.tsx
│   └── contact/page.tsx
├── lib/
│   ├── connectors/
│   │   ├── index.ts                 # registry (name → delete fn)
│   │   ├── meta.ts                  # display metadata + field defs (single source)
│   │   ├── fetchHelper.ts           # timeout + retry-with-backoff (10s, 2 retries)
│   │   ├── specs/ (declarative specs for 6 connectors)
│   │   └── engine/ (http, sql, interp, types, util)
│   ├── engine/
│   │   ├── orchestrator.ts
│   │   ├── ratelimit.ts
│   │   └── metering.ts
│   ├── security/ (crypto.ts, signing.ts)
│   ├── auth/ (keys.ts, middleware.ts)
│   ├── billing/ (dodo.ts)
│   ├── audit/ (pdf.ts, logger.ts)
│   ├── db/ (supabase.ts, browser.ts)
│   └── constants/compliance.ts
├── types/ (connector.ts, deletion.ts, api.ts)
├── supabase/migrations/ (001–009)
├── test/integration.test.ts
├── .env.local.example
├── package.json
├── tsconfig.json
└── vercel.json
```

## Dependency budget

Target: `npm install` under 400 MB, production bundle under 1 MB gzipped. Every new dependency must be justified in the PR/commit message with "why existing dep doesn't cover it" per HARNESS.md scope discipline.
