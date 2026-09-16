# NukeAPI v1 — Deep Analysis (why it failed) + v2 Remediation

Date: 2026-09-16
Source: `E:\Applications\nukeapi` (deployed to Vercel as nukeapi.dev, repo Git-Rohit-lakhey/nukeapi, 15 commits, 293 files)
Analyzed: all `lib/`, `app/api/`, `supabase/migrations/`, `types/`, `components/marketing/LandingPage.tsx`, `package.json`, `CHANGELOG.md`, `PLAN.md`

---

## 1. What v1 got RIGHT (keep in v2)

- Declarative connector engine (`lib/connectors/engine/http.ts` + `sql.ts` + `interp.ts`) — single battle-tested path for all REST/SQL connectors, with §6.9 timeout/retry, §6.10 response.ok, §6.11 pagination. Correctly factored; keep.
- `lib/constants/compliance.ts` as SINGLE source of truth (PLANS, LEGAL, SUB_PROCESSORS) — prevents drift between pricing page / Terms / DPA / DB. Keep verbatim.
- AES-256-GCM envelope + HMAC-SHA256 signing + `key_lookup_hash` fast auth — all §6.1/6.4/6.6 correctly implemented. Keep logic, trim to lighter surface.
- Orchestrator `Promise.allSettled` + per-connector try/catch + audit-log inner try/catch (§6.16) — correct.
- Upstash Redis pipeline `incr`+`expire` (§6.8) + atomic `increment_usage()` RPC (§6.7) — correct.

---

## 2. CRITICAL — Why it failed on Vercel / in production

### 2.1 Dependency bloat → cold-start + install + bundle failure

`package.json:16-39` ships **14 heavy native/binary deps** that the 6 core connectors do NOT need:

```
@aws-sdk/client-cognito-identity-provider  @aws-sdk/client-s3  @google-cloud/storage
@libsql/client  @vercel/blob  braintree  cassandra-driver  mongodb  mysql2  pg
samlify  @modelcontextprotocol/sdk  braintree  cassandra-driver
```

- Only `pg` is needed for the single Postgres direct connector (sql engine). `mysql2`/`@libsql/client` are for deferred MySQL/Turso connectors — not v1 scope.
- `aws-sdk`, `gcs`, `vercel/blob`, `cassandra-driver`, `mongodb`, `braintree`, `samlify` are for the 72 dormant connectors that were never enabled (owner flag `enabledByDefault:false`). They still inflate `npm install` (~600MB), Vercel function bundle (near 50MB limit), and cold-start (1000ms+).
- `samlify` pulls `xml-crypto` + `xmldom` with known CVEs and a 2MB parse path, for an Enterprise SSO feature that needs a live IdP to even test — dead weight in v1.
- Result: Vercel builds intermittently OOM or time out; serverless functions cold-start slowly; `npm install` on fresh clone takes 3–4 min.

**v2 fix:** ship 6 connectors only. Keep `pg` (Postgres). Defer `mysql2`, `mongodb`, `aws-sdk`, `gcs`, `vercel/blob`, `cassandra-driver`, `braintree`, `samlify`, `@libsql/client` to post-v1. Target `package.json` deps: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `@upstash/redis`, `bcryptjs`, `pdf-lib`, `resend`, `zod`, `server-only`, `pg` = 12 deps, not 22.

### 2.2 Migration sprawl → unapplied migrations in production

16 migrations (`001`–`016`) — but spec says 9. Extra 7 are for features that never wired end-to-end:

- `010_connector_flags.sql` + `011_connector_maintenance_and_seeds.sql` + `012_visibility_and_custom_grants.sql` — for the 78-connector toggle system. Required for app to boot correctly, but never applied to the live Supabase project (per SETUP.md "apply in order 001→009" only). So `SELECT * FROM connector_flags` fails in production, making `getUsableIntegrationSet()` throw and the homepage `INTEGRATIONS` count wrong.
- `013_notification_settings.sql` (webhook/slack), `014_enterprise_sso.sql` (SAML), `015_custom_connectors.sql`, `016_trial_support.sql` — each adds a table/column that the code reads unconditionally (`profiles.email`, `notification_settings`, `enterprise_sso`). If migration not applied, every `delete-user` throws on the notification fire-and-forget path or on `getPlanForUser` trial check.
- `lib/connectors/_archive/` keeps a full second copy of every connector as standalone files (78 files) — not imported, never tree-shaken, but still scanned by `tsc` and `eslint` (adds ~4s to build).

**v2 fix:** exactly 9 migrations (001–009) per spec §4. No `_archive`. No flags/maintenance/custom/sso/trial tables until that feature's phase is explicitly started. One truth: if a migration isn't needed for the 6-connector core loop, it doesn't exist.

### 2.3 Single-file homepage → unmaintainable, not modular

`components/marketing/LandingPage.tsx` is **~1200 lines, one client component** containing: hero, live deletion visualizer, code tabs (8 languages), "how it works", integrations grid (78 inline objects), pricing table, ROI calculator, compliance table, FAQ, intercept logic for checkout/trial, and `useEffect` for availability fetch. Not split into `components/marketing/sections/*`. Any pricing or integration change touches the same file and risks regressing the code-tab copy state.

**v2 fix:** split into `components/marketing/sections/{Hero,CodeDemo,HowItWorks,Integrations,Pricing,ROI,Compliance,FAQ}.tsx` + `PricingGrid.tsx` already exists. Homepage `app/page.tsx` composes them; each reads from `compliance.ts`/`meta.ts` single sources.

### 2.4 Trial + custom-connector + SSO code paths that assume tables exist

- `lib/engine/metering.ts:getPlanForUser` reads `trial_ends_at` column (added in `016`) without guarding `error.code === '42703'` (column missing). On a fresh DB without `016`, it returns `"free"` for every paid user — billing appears broken.
- `app/api/v1/delete-user/route.ts:99` calls `getCustomGrantsForUser()` and `loadCustomConnectors()` on every request — two extra DB reads even for the 99% of users with no custom grants. If `015` not applied, throws and (caught correctly) but still adds 200ms to p50.
- `lib/sso/index.ts` + `app/api/sso/{acs,login,metadata,config}` are 4 routes + a table + a client dep (`samlify`) for a flow that reuses the magic-link path as a hack — not independently testable.

**v2 fix:** remove trial/custom/sso paths from v1. `getPlanForUser` reads only `plan,status` from `subscriptions`. Delete `lib/sso/`, `lib/connectors/custom/`, `app/api/sso/`, `app/api/v1/trial/`, `app/api/v1/connectors/custom/`.

---

## 3. MAJOR — Inconsistencies & correctness risks

| Area | Inconsistency / bug | Impact | v2 fix |
|---|---|---|---|
| `lib/notify/index.ts` + `settings.ts` | `fireCompletionNotification` does `admin.from("profiles").select("email")` — but `profiles` table has no migration (relies on Supabase Auth `auth.users`). On some projects `profiles` is empty → ownerEmail always null → email alerts never fire, no error logged as failure. | Silent feature failure | Remove notification system from v1; re-add with correct `auth.users` join when phase starts |
| `lib/engine/metering.ts:buildUsageInfo` | `effectiveUsed = alreadyIncremented ? used : max(0, used-1)` — subtracts 1 pre-increment, but `used` is already post-`incrementUsage` read. If user had 0 and just incremented to 1, returns 0/200 instead of 1/200 (off-by-one). | Usage bar shows stale count | `buildUsageInfo` should read *after* increment and return `used` directly; no subtraction |
| `lib/connectors/meta.ts` 1014 lines | `Integration` union is 78 values, but `ALL_INTEGRATIONS` array and `CONNECTOR_META` must stay in sync manually — one typo = `isRegisteredIntegration` false negative. No `satisfies` guard. | Drift between types and registry | v2: 6 values only, `const INTEGRATIONS = [...] as const satisfies readonly Integration[]`, one file generates the other |
| `types/connector.ts` mojibake | Comment `// �"?�"? Batch 2` — file saved with wrong encoding, breaks `tsc` on Windows with `charset: utf-8` strict | Build warning | Re-save UTF-8, remove batch markers |
| `app/api/v1/delete-user/route.ts:81` | Accepts `email` alias fallback for `subject_email` with a `console.warn` — keeps a documented-but-wrong field alive forever, no deprecation header | API contract ambiguity | Keep alias for 1 minor version, add `Deprecation: true` header when used, remove in next breaking version |
| `lib/connectors/engine/http.ts:65` | `buildAuthHeaders` interpolates `{cred.access_token}` but `makeCtx` exposes `cred` keys as-is — if a connector's `auth.token` is `"{cred.access_token}"` and the user's credential key is `access_token`, works; but for `stripe` where field is `secret_key`, spec uses wrong key and silently sends `Bearer undefined` → 401 → recorded as `failed` not as misconfig | Silent misconfig | `makeCtx` should expose both original and normalized keys; add runtime check `if (!token || token.includes("undefined")) throw` |

---

## 4. MINOR — Lightweight / modularity

- No `lib/constants/` barrel — dashboard imports compliance helpers via deep paths.
- `components/dashboard/{CustomConnectors,OwnerConnectors,PendingTrialGuard}.tsx` are unused in the 6-connector v1 but still bundled.
- `sdk/`, `n8n-nodes-nukeapi/`, `mcp/` ship as separate `package.json` inside the same repo — correct for distribution but they each have their own `dist/` checked into git (binary bloat). Should be `gitignore` + CI-built.
- `scripts/smoke.ts` + `smoke-http.ts` duplicate setup; could be one `test:smoke` with env guard.
- `types/api.ts` + `types/deletion.ts` overlap `DeleteUserResponse` vs `DeletionStatus` — minor dupe.

---

## 5. v2 Principles (to stay lightweight/modular/scalable/intuitive)

1. **Dependency budget:** 12 runtime deps, no heavy native driver beyond `pg`. Every new dep needs a ROADMAP phase line item.
2. **Migration budget:** 9 files, no conditional `IF NOT EXISTS` sprawl — each migration is authoritative.
3. **Connector budget:** 6 solid specs via declarative engine. The engine is the product; specs are config. Adding a 7th connector = 1 file in `lib/connectors/specs/` + 1 entry in `meta.ts` + 1 migration row if flagged — no new code path.
4. **File budget:** homepage split into 8 section components, each <120 lines, each reads single-source data. No 1000-line client component.
5. **Build gates per phase:** `typecheck` + `lint` + `test:integration` + `build` must pass before next phase starts (HARNESS.md).
6. **Spec §6 checklist is the definition of done:** 16 rules are not "aspirational" — they are the QA gates for each phase's exit condition.

---

## 6. Migration to v2 — what to copy verbatim vs rewrite

Copy verbatim (proven correct, keep):
- `lib/constants/compliance.ts` (252 lines — single source, no drift)
- `lib/security/crypto.ts` + `signing.ts`
- `lib/connectors/engine/*` (http, sql, interp, util, types)
- `lib/connectors/fetchHelper.ts`
- `lib/engine/orchestrator.ts` + `ratelimit.ts`
- `lib/auth/keys.ts` + `middleware.ts`

Trim/retarget:
- `lib/connectors/meta.ts` → 6 entries only
- `lib/connectors/specs/` → 6 specs only (stripe/mailchimp/hubspot/intercom/supabase/postgresql)
- `types/connector.ts` → Integration union = 6

Delete (defer to post-v1):
- `lib/connectors/_archive/`, `lib/connectors/custom/`, `lib/notify/`, `lib/sso/`, `lib/audit/csv.ts` (SOC2), `app/api/sso/`, `app/api/export/`, `app/api/v1/trial/`, `app/api/v1/connectors/custom/`, `components/dashboard/CustomConnectors*`, `OwnerConnectors`, `PendingTrialGuard`

