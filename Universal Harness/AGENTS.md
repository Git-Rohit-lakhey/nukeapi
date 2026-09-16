# NukeAPI — AGENTS.md

## What this is

NukeAPI is a GDPR/CCPA/LGPD user-deletion API — one authenticated call with a user email fans out in parallel across Stripe, Mailchimp, HubSpot, Intercom, Supabase and Postgres, deletes the user everywhere, and returns a cryptographically signed PDF audit trail. Developer-first, self-serve, single-responsibility: make a DSAR (Right to Erasure) request disappear from every tool in 15 minutes.

- **API surface (the product):** `POST /api/v1/delete-user` + API-key auth + signed PDF + dashboard (connectors/keys/requests/billing). This is the ONLY core loop.
- **Admin/operator mode:** the connector dashboard, keys manager, billing/plan controls, owner page — all exist to support the single deletion call. Not a second product.
- **v1 scope (this build):** 6 connectors (Stripe, Mailchimp, HubSpot, Intercom, Supabase, Postgres) via declarative engine. No SSO, no SOC2 attestations, no custom connectors, no Slack/webhook fleet — those are post-v1. The harness enforces this.

## Non-negotiable product rule

> **One API call deletes everywhere — and proves it.** Every feature exists to make that call trustworthy or faster to integrate. If a change adds a second way to delete, weakens the cryptographic proof, stores credentials in plaintext, or makes the happy path slower without a security justification — stop and flag it instead of building it. See CLAUDE.md Section 6 before touching auth, crypto, billing, or rate-limiting.

## Tech stack (see TECH_STACK.md for detail)

- Next.js 15 (App Router), TypeScript strict, deployed on Vercel serverless
- Supabase Postgres + Auth + RLS (service_role only server-side)
- Upstash Redis for rate limiting (never in-memory)
- Dodo Payments for billing (test/live URLs, Standard Webhooks)
- Resend for transactional email
- pdf-lib for signed PDF
- Tailwind / inline dark theme, lime #c8ff00 accent

## Conventions

- Functional components only, no class components
- One component per file, named exports, PascalCase.tsx
- `lib/constants/compliance.ts` is the SINGLE source of truth for plan limits, prices, overage, legal figures — never duplicate into a DB table or a second file
- `lib/connectors/meta.ts` is the single source for connector display metadata + required fields
- `lib/connectors/index.ts` is the runtime registry — orchestrator and routes never import per-connector code directly
- `lib/connectors/engine/` is the only place that touches HTTP/SQL — connectors are declarative specs, not per-integration code files
- All server-only crypto/signing code imports `server-only` and never reaches the client bundle
- All async deletions use `Promise.allSettled` — one failing integration never hides another's result
- No magic numbers for pricing/limits — pull from compliance.ts so legal copy never drifts

## Commands

```
npm run dev              # next dev
npm run typecheck        # tsc --noEmit
npm run lint             # eslint (next/core-web-vitals)
npm run build            # next build
npm run test:integration # node --import tsx --test test/*.test.ts
npm run smoke            # real connector smoke (needs live creds)
```

## Folder structure

See TECH_STACK.md for the full annotated tree (matches CLAUDE.md Section 3 exactly). Do not introduce a parallel convention (e.g. a second state manager, a second connector system) mid-build.

## What NOT to build yet (deferred post-v1)

- SSO / SAML / Active Directory
- SOC 2 attestation export (audit CSV exists; attestation does not)
- White-label PDFs
- Custom HTTP connectors (Enterprise — defer)
- Slack/webhook fleet beyond the spec's single optional `webhook` param
- More than 6 connectors — 78-connector catalog is marketing bloat; prove 6 solidly first
- Any `plan_limits` table — limits live only in compliance.ts

## Roles

See ROLES.md. Custom subagents under `.opencode/agent/`:
- `@security-checker` — reviews any change touching `lib/security/*`, `lib/auth/*`, `lib/engine/ratelimit*`, `lib/billing/*` against CLAUDE.md Section 6 (16 rules)
- `@connector-guardian` — reviews any change touching `lib/connectors/*`, `lib/engine/orchestrator*` for timeout/retry/response.ok/pagination correctness

## Working discipline

Read HARNESS.md before starting any task. It governs the verify-before-claiming-done loop, anti-hallucination rules, scope discipline, and the required end-of-task report format. Also read CHANGELOG.md before starting any task — preserve VERIFIED behavior and update the log in the same turn when you change a VERIFIED path.
