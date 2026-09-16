# NukeAPI v2 — Remaining Roadmap to Complete, Functional & Monetizable

**Where we are:** Phases 0–6 GREEN. App builds (29 routes), tests 9/9, Supabase live (all tables + RPCs exist), Dodo test_mode configured, env copied.

**Will the app do what it's meant to do?** YES for the core API loop (`POST /api/v1/delete-user` → parallel deletes → signed PDF → metering). NO for the human surface — homepage is a one-liner, auth/dashboard are `<div>Stub</div>`, no way for a real user to sign up, connect Stripe, buy a plan, or download a PDF without curl. That human surface IS the monetization funnel, so we must finish it.

---

## Phase 7 — Marketing & Conversion (homepage + docs + legal + status) — 1 day — DO FIRST

**Why first:** No homepage = no conversions. This is the money page. Also unblocks Vercel deploy preview.

- [ ] **7a. Homepage** (`app/page.tsx`): hero (trust badge, lime CTA), code tabs (curl/node/python), integrations grid (6 cards from `CONNECTOR_META`), compliance table (`LEGAL`), pricing grid (`PLANS` from `compliance.ts`), ROI math, FAQ, footer. Extracted from `E:\Applications\nukeapi\components\marketing\LandingPage.tsx` but trimmed to 6 integrations and split into `components/marketing/sections/*`. Exit: `FREE_INTEGRATIONS` matches code example, pricing numbers appear, CTA goes to `/signup`.
- [ ] **7b. Docs** (`app/docs/page.tsx`): code examples for 6 integrations, error table, rate-limit note.
- [ ] **7c. Legal** (`app/terms|privacy|dpa|refund`): render from `LEGAL` + `SUB_PROCESSORS` (single source) so Terms ↔ DPA never drift.
- [ ] **7d. Status** (`app/status/page.tsx` + `app/api/status`): live pings to `/api/health`.
- [ ] **7e. Blog** (`app/blog`): 1 post "How to Handle GDPR Erasure Automatically".

**Exit:** Homepage Lighthouse >90, pricing/legal figures match `compliance.ts`, `npm run build` still green.

## Phase 8 — Auth (signup / login / reset) — half day

- [ ] Wire Supabase SSR: `lib/db/supabase.ts` already lazy, `lib/db/browser.ts` done. Build `(auth)/login`, `signup`, `reset-password`, `update-password` using `supabase.auth` + `getSessionUser`. Match `nukeapi` auth pages (dark/lime). Add `app/auth/callback/route.ts` for email confirm.
- [ ] Guard `(dashboard)/layout.tsx`: redirect unauth → `/login`.

**Exit:** Manual signup → confirm email → login → hit `/dashboard` (no redirect).

## Phase 9 — Dashboard (THE monetization surface) — 1.5 days — CRITICAL

This is where users **pay**. Get this wrong and Dodo never sees a checkout.

- [ ] **9a. Connectors** (`(dashboard)/connectors`): list 6 cards from `CONNECTOR_META`, form per field, `POST /api/v1/connectors/save` (already AES-256 encrypted server-side). Show "connected ✓" vs "connect". Validate identifiers for `postgresql`.
- [ ] **9b. API Keys** (`(dashboard)/keys`): `POST /api/v1/keys/create` (raw shown once), list + revoke, copy button.
- [ ] **9c. Requests** (`(dashboard)/requests`): `deletion_requests` + `audit_logs` table, status badge, duration, PDF download button (`/api/requests/[id]/pdf`).
- [ ] **9d. Settings / Billing** (`(dashboard)/settings`): **THIS IS MONETIZATION**. Show current plan (`getPlanForUser`), usage meter (`usage_meters` vs `PLANS[plan].includedDeletions`), pricing upgrade cards, `POST /api/checkout` → redirect to `checkoutUrl`, `POST /api/v1/subscription/cancel` (calls Dodo first, then local — §6.12), `POST /api/v1/account/delete`.
- [ ] **9e. Support** (`(dashboard)/support`): `POST /api/feedback` via Resend.
- [ ] **9f. Owner** (`(dashboard)/owner`): email-allowlisted (`OWNER_EMAILS`), show MRR via `subscriptions` count.

**Exit:** New user can sign up → connect Stripe → create key → `curl` delete with that key → see request in dashboard → click "Upgrade to Startup $99" → landed on Dodo test checkout.

## Phase 10 — PDF Audit Download — half day

- [ ] **10a.** `lib/audit/pdf.ts` already does HMAC footer. Add `app/api/requests/[id]/pdf/route.ts` (session-auth, owns request, streams `application/pdf` via `pdf-lib`).

**Exit:** After a delete, `GET /api/requests/{id}/pdf` returns PDF whose footer `auditSignature` verifies via `verifyAudit`.

## Phase 11 — Supabase Migration Verification — 2 hours

- Already verified: live Supabase has all 9 tables + `increment_usage` + `user_id_by_email`. But **re-run idempotently**: `psql` or Supabase SQL editor → paste `supabase/migrations/001–009` sequentially (they are `IF NOT EXISTS` + `CREATE OR REPLACE`). Confirm no errors.
- **Rollback plan:** migrations are additive; no destructive `DROP`.

**Exit:** `select * from pg_tables where schemaname='public'` shows 9 expected tables; `select proname from pg_proc where proname in ('increment_usage','user_id_by_email')` → 2 rows.

## Phase 12 — GitHub — 1 hour

- [ ] `git init` in `nukeapi_v2_latest`, `.gitignore` already excludes `.env.local`.
- [ ] **Decision:** new repo `nukeapi-v2` vs push to `Git-Rohit-lakhey/nukeapi` on `v2` branch? **Recommend:** new repo `nukeapi-v2` (clean history, lightweight) OR `v2` branch on same repo (keeps stars). **Ask user.**
- [ ] `git add .`, `git commit -m "feat: v2 lightweight rebuild — 6 connectors, 12 deps, 9 migrations, 9/9 tests"`, `git remote add origin …`, `git push -u origin main`.

**Exit:** GitHub shows repo with README + `ROADMAP_REMAINING.md` + green CI.

## Phase 13 — Vercel Deploy — 1 hour

- [ ] New Vercel project from GitHub import (or `vercel --prod`).
- [ ] Set all env vars from `.env.local` in Vercel dashboard (Supabase, Upstash, Resend, Dodo ×8 products, `NEXT_PUBLIC_APP_URL=https://www.nukeapi.dev`).
- [ ] Set Dodo webhook URL to `https://<vercel-domain>/api/webhooks/dodo` in Dodo dashboard, copy `DODO_WEBHOOK_SECRET` already set.
- [ ] Deploy, check `/api/health` 200, `/` renders.

**Exit:** `https://<vercel-preview>/api/health` → `{success:true}`.

## Phase 14 — Monetization E2E Test — 2 hours — THE proof

Run against **deployed** Vercel + live Supabase test_mode:

1. Signup new test user (`lakheyrohit+test99@gmail.com`).
2. `POST /api/checkout` with `plan=startup` → assert `checkoutUrl` contains `test.dodopayments.com` + correct `pdt_…` ID.
3. Simulate / trigger Dodo `subscription.active` webhook (or use Dodo test card `4242…` to complete checkout) → assert `subscriptions.plan = 'startup'` in DB (not swallowed).
4. Create API key, `POST /api/v1/delete-user` with `subject_email`, `integrations:['stripe']` → assert `200 completed` + `auditSignature` + `usage.used` increments by 1.
5. `POST /api/v1/subscription/cancel` → assert Dodo API PATCH called (mock or test sub) + local `status='cancelled'` only after success (never before §6.12).
6. Verify 61st request in 60s → `429`, and meter 21st delete on free → `402 QUOTA_EXCEEDED`.

**Exit:** All 6 steps log `PASS`, screenshots of checkout + dashboard + PDF.

## Phase 15 — Final Hardening & Launch — half day

- [ ] Walk `CLAUDE.md` §6.1–6.16 checklist (16 items) and tick each with file:line evidence.
- [ ] `npm run typecheck` 0, `npm run lint` 0, `npm run test:integration` 9/9, `npm run build` 0.
- [ ] Lighthouse + `sitemap.ts` + `robots.ts` + SEO.

---

## What to do NOW (next 30 min)

1. **You pick GitHub strategy** (new repo `nukeapi-v2` vs branch `v2` on existing `nukeapi`).
2. **I build Phase 7a homepage first** (highest monetization impact) while you confirm Dodo products are correct in `.env.local` (they look correct: `pdt_0Njsd…`).
3. Then Phase 8 auth + 9 dashboard/billing in order.

**No monetization works until Dashboard Settings → Checkout → Webhook → Plan upgrade flow is wired end-to-end. That's Phases 9d + 11 + 14 — we hit that within the next session.**

