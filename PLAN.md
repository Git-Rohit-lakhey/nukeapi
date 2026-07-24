# NukeAPI — Living build plan & session handoff

Date: 2026-07-20
Status: GREEN (typecheck / lint / build / integration tests all pass).
Active task: **Docs & client-library release (this pass).** Option B is
SHIPPED; the TypeScript SDK, n8n node, and MCP server are built & passing.
Remaining work is documentation/top-level release notes only.

This file is the canonical "where we are / what's next" snapshot. If the
chat context is lost, read THIS file + CHANGELOG.md (top two entries) and
you can resume without the conversation history.

---

## 1. Current verified-good state

- **Connector registry complete:** 78/78 connectors registered in
  `lib/connectors/index.ts`, matching `meta.ts` and the `Integration`
  union in `types/connector.ts`.
- **Type check:** `npm run typecheck` → 0 errors.
- **Lint:** `npm run lint` → 0 errors.
- **Build:** `npm run build` → exit 0.
- **Client libraries SHIPPED:** `@nukeapi/sdk` (v1.0.0, dependency-free),
  `n8n-nodes-nukeapi` (v1.0.0), and `mcp/` server (stdio) are all built and
  pass their own `typecheck` / `build`. SDK methods: `deleteUser`,
  `getRequest`, `getStatus`. n8n ops: Delete User / Get Request / Get Status
  / List Integrations. MCP tools: `nuke_delete_user`, `nuke_get_request`,
  `nuke_status`, `nuke_list_integrations`. All three share the product's
  78-integration catalog as the single source of truth.
- **Integration tests:** `npm run test:integration` → 17/17 pass.
- **Distribution zip:** `E:\Applications\nukeapi-dist.zip` (193 entries,
  ~319 KB; excludes node_modules/.next/.git/.claude/*.tsbuildinfo/.env.local;
  root prefix `nukeapi/`).

### Source of truth files
- Plan limits / prices / overage / legal figures: `lib/constants/compliance.ts`
  (deliberately NO `plan_limits` table).
- Connector metadata: `lib/connectors/meta.ts`; registry: `lib/connectors/index.ts`.
- Connector availability flags: `lib/connectors/flags.ts` + migration
  `supabase/migrations/010_connector_flags.sql`.
- Core delete endpoint: `app/api/v1/delete-user/route.ts`.
- Signed PDF: `lib/audit/pdf.ts`; PDF download route
  `app/api/requests/[id]/pdf/route.ts`.
- Audit signing (HMAC-SHA256): `lib/security/signing.ts`.
- Per-user plan lookup helper: `getPlanForUser(userId)` (used in
  delete-user route) — reuse for all plan-gating.
- Email: Resend client (configured for transactional email).

---

## 2. SHIPPED — Option B: build the features (all shipped; see CHANGELOG top entry)

Decision: implement the features the pricing page promises, then
plan-gate them, so the copy is literally true. (Earlier Option-A edits
that DELETED the claims from `components/marketing/LandingPage.tsx` must
be REVERTED first — see §4 step 0 — so the claims stay and get backed.)

### 2.0 Revert (do this first)
- `components/marketing/LandingPage.tsx` PLANS array currently has the
  false/misleading claims removed (Option-A). Restore the ORIGINAL claims:
  Startup: "PDF audit reports", "Webhook callbacks". Business: "SHA-256
  cryptographic audit logs", "Slack & email alerts". Enterprise:
  "Custom connectors", "SOC 2 Type II export", "SSO / Active Directory",
  "White-label PDF reports". (Original text is in CHANGELOG
  "pricing & feature-claim audit" entry §2b/§2c, and in git history.)

### 2.1 FALSE → build these (currently unimplemented)
1. **Webhook callbacks (Startup+)** — outgoing POST of the deletion result
   JSON to a user-configured endpoint on completion.
   - Storage: add `webhook_url text` to `profiles` (nullable) OR a new
     `webhook_endpoints` table (recommend the latter for multiple URLs).
     New migration `supabase/migrations/013_webhook_endpoints.sql`.
   - Fire in `delete-user/route.ts` AFTER the response is built (line ~250),
     fire-and-forget with a timeout/retry wrapper (reuse the pattern from
     `lib/connectors/fetchHelper.ts`). Do NOT block the API response.
   - Gate: only fire when `getPlanForUser` ∈ {startup, business, enterprise}.
   - Set the URL via a new `app/api/v1/webhook/route.ts` (session-auth) +
     a field on the Settings page.
2. **Slack & email alerts (Business+)** — notify the user on completion.
   - Email: reuse Resend to email the request owner (already configured).
   - Slack: store `slack_webhook_url` (per user); POST a simple message.
   - Gate to Business+ (`getPlanForUser` ∈ {business, enterprise}).
   - Consider folding into the same completion-notification helper as (1).
3. **SOC 2 Type II export (Enterprise)** — downloadable compliance artifact.
   - New `GET /api/export/soc2/route.ts` (session-auth, Enterprise only):
     export the account's `deletion_requests` + `audit_logs` (CSV and/or
     signed PDF summary). This is a generated report, NOT a real SOC 2
     attestation — keep copy accurate ("SOC 2 export" = exportable audit
     evidence, which is what the product can honestly deliver).
4. **SSO / Active Directory (Enterprise)** — HIGHEST EFFORT.
   - Wire Supabase Auth SAML/SSO (or a SAML lib) so Enterprise users log in
   via their IdP. This touches auth flow, not just a route. Scope as the
   last / largest item; may need an `enterprise_sso` config table.
5. **White-label PDF reports (Enterprise)** — `lib/audit/pdf.ts`:
   add an optional `whiteLabel?: boolean` to `AuditPdfInput`; when true,
   skip drawing the `NukeAPI` wordmark (line 39) / use neutral branding.
   Pass it from the PDF route when the user's plan is enterprise.

### 2.2 MISLEADING → make truly tier-exclusive
6. **PDF audit reports (Startup+)** — gate
   `app/api/requests/[id]/pdf/route.ts` to paid plans: return 403 for
   `free`. Currently gated only by auth + ownership.
7. **Custom connectors (Enterprise)** — restrict `custom_connector_grants`
   (in `lib/connectors/flags.ts` + `app/api/admin/connectors/grants`) so
   grants can only target Enterprise-plan users. Update admin UI copy.
8. **SHA-256 audit logs (Business+)** — KEEP signing universal (do NOT
   weaken free-tier security). Instead give Business a REAL exclusive audit
   feature (e.g. extended audit-log retention window or a "download full
   audit log" export) and word the copy to that. Decide exact shape when
   building (6)/(3).

### 2.3 Soft claims (no code) — leave or soften
"Test console access", "Community / Priority email / Dedicated support SLA".

---

## 3. Where the pricing/plan copy lives (edit targets)
- `components/marketing/LandingPage.tsx` — PLANS array (the claims).
- `components/marketing/PricingGrid.tsx` — renders from `compliance.ts`
  (deletions/integrations/overage only; already accurate, NO false claims).
- Legal pages reuse `LEGAL` + `SUB_PROCESSORS` from `compliance.ts` — do not drift.

---

## 4. Recommended implementation order
0. **Revert** the Option-A deletions in `LandingPage.tsx` (restore claims).
1. Add `webhook_url` / `slack_webhook_url` storage + migration `013_*`.
2. Build the completion-notification helper (webhook + Slack + email) fired
   from `delete-user/route.ts`, gated by plan.
3. White-label PDF flag (`lib/audit/pdf.ts` + PDF route).
4. Gate PDF download route to paid plans (Startup+).
5. Enterprise: SOC 2 export route; custom-grant Enterprise-only restriction.
6. Enterprise SSO (largest; do last).
7. After each feature: `npm run lint` + `npm run typecheck` + `npm run build`.
8. Regenerate `E:\Applications\nukeapi-dist.zip` once all code changes land.
9. Update CHANGELOG.md with what actually shipped.

---

## 5. Environment / runtime prerequisites (outside this code task)
- Live Supabase (apply migrations 001–013), Dodo Payments, Upstash Redis,
  Resend configured for real runs. Migrations `010`, `012`, and the new
  `013` must be applied for flags/webhooks to work.
- Without `SUPABASE_SERVICE_ROLE_KEY` the orchestrator audit-log write
  throws — EXPECTED in tests; results are still preserved (spec §6.16).

## 6. Definition-of-Done gates (spec §11 step 13) — all currently GREEN
`npx tsc --noEmit` ✓ · `npx eslint .` ✓ · `npm run test:integration` ✓ ·
`npx next build` ✓.
