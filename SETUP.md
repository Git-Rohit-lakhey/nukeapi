# NukeAPI — Setup

Developer-first GDPR/CCPA/LGPD user-deletion API. One authenticated call fans
out across Stripe, Mailchimp, HubSpot, Intercom and Supabase, with
AES-256-encrypted credentials and a cryptographically signed PDF audit trail.

## 1. Install

```bash
npm install
cp .env.local.example .env.local   # then fill in every value
```

## 2. Environment

All variables are documented in `.env.local.example`. Critical ones:

- `CREDENTIALS_ENCRYPTION_KEY` — `openssl rand -base64 32` (AES-256-GCM key)
- `AUDIT_SIGNING_SECRET` — `openssl rand -hex 32` (HMAC-SHA256 audit signing)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — rate limiting
- `DODO_PAYMENTS_*` — billing (test mode base URL is `https://test.dodopayments.com`)
- `SUPABASE_*` — database, auth, storage

## 3. Database

Apply the migrations in `supabase/migrations/` in order (001 → 009) via the
Supabase SQL editor or CLI. They create the tables, RLS policies, the
`increment_usage()` atomic RPC, and the `user_id_by_email()` webhook lookup.

## 4. Develop

```bash
npm run dev
```

## 5. Verify

```bash
npm run typecheck          # tsc --noEmit
npm run lint               # eslint .
npm run test:integration   # mock-server integration tests (no real creds)
npm run build              # production build
```

## 6. Deploy

- `vercel.json` ships a keepalive cron (`/api/cron/keepalive`, gated by `CRON_SECRET`).
- Connect the Git repo to Vercel. Set all env vars in the Vercel dashboard.
- Dodo webhook endpoint: `/api/webhooks/dodo` (Standard Webhooks signature).

## 7. Live smoke test

`scripts/smoke.ts` performs a real create → delete → verify cycle against test
Stripe / Mailchimp accounts, calling the actual connector functions (no Supabase
or HTTP layer required). A unique throwaway email is used each run.

```bash
export STRIPE_TEST_SECRET_KEY=sk_test_...
export MAILCHIMP_TEST_API_KEY=... MAILCHIMP_TEST_SERVER_PREFIX=usX
export MAILCHIMP_TEST_LIST_ID=...   # enables a real add+delete (optional)
npm run smoke
```

It exits non-zero only on a genuine failure (deletion returned `failed`, or the
fixture was still present). Missing credentials → WARN + skip.

## 8. Full HTTP smoke test

`scripts/smoke-http.ts` boots the real Next.js server and fires a real
`POST /api/v1/delete-user`, exercising the entire pipeline (API-key auth → rate
limit → plan/usage → orchestrator → HMAC signing → atomic usage → response). It
creates an isolated throwaway user + API key (stored exactly as the app stores
them, with AES-256-GCM-encrypted creds), runs the request, asserts the response,
and deletes the user at the end.

```bash
# Required: Supabase + encryption/signing keys (from .env.local)
export STRIPE_TEST_SECRET_KEY=sk_test_...        # optional, enables live deletion
npm run smoke:http
```

With `STRIPE_TEST_SECRET_KEY` set it also performs a true create → delete →
verify-gone against the live Stripe account. Missing required env → prints a
checklist and exits 0.

## 9. Client libraries

NukeAPI ships three finished, ready-to-use client packages. Each is built and
passes `typecheck` / `build` independently.

### TypeScript SDK — `@nukeapi/sdk`

Dependency-free, ESM-first, TypeScript strict SDK.

```bash
cd sdk
npm install      # dev deps only
npm run build    # tsc -> dist/ (emits .js + .d.ts + maps)
```

Publish to npm:

```bash
cd sdk
npm publish      # "files": ["dist"] — only dist/ reaches the registry
```

Consume it in any project with `npm install @nukeapi/sdk`. Methods:
`deleteUser`, `getRequest`, `getStatus`. See `sdk/README.md`.

### n8n community node — `n8n-nodes-nukeapi`

```bash
cd n8n-nodes-nukeapi
npm install
npm run build    # tsc -> dist/ (+ copies nukeapi.svg)
```

Install into n8n (published package): `npm install n8n-nodes-nukeapi`, then
restart n8n. For local dev use `npm link` or copy the built package into
`~/.n8n/custom/`. Four operations: Delete User / Get Request / Get Status /
List Integrations. See `n8n-nodes-nukeapi/README.md`.

### MCP server — `mcp/`

A stdio MCP server (no separate build — runs with `tsx`).

```bash
NUKEAPI_BASE_URL=http://localhost:3000 \
NUKEAPI_API_KEY=nk_test_xxx \
npm run mcp
```

`npm run mcp` is equivalent to `npx tsx mcp/server.ts`. Wire it into Claude
Desktop (`mcp/claude_desktop_config.json`) or Cursor (`.cursor/mcp.json`).
Four tools: `nuke_delete_user`, `nuke_get_request`, `nuke_status`,
`nuke_list_integrations`. See `mcp/README.md`.


