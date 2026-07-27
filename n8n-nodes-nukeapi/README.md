# n8n-nodes-nukeapi

An [n8n](https://n8n.io) community node for [NukeAPI](https://nukeapi.com) — a
GDPR / CCPA / LGPD user-deletion API. Send one call with a user's email and NukeAPI
fans it out across your connected integrations, deleting that user's data everywhere
and returning a structured result plus a cryptographically signed audit trail.

NukeAPI supports **78 integrations** (Stripe, Mailchimp, HubSpot, Intercom, Supabase,
PostgreSQL, Salesforce, Segment, Klaviyo, SendGrid, Auth0, Clerk, PostHog, Zendesk,
Mixpanel, and ~65 more — full list via the **List Integrations** operation).

## Features

- **Delete User** — delete a user across selected integrations (or all connected ones)
  in one call. Optionally fire a signed webhook on completion. Returns the full `data`
  object: per-integration results, audit signature, and usage.
- **Get Request** — fetch the status of a previous deletion request by ID.
- **Get Status** — public NukeAPI system health check (no key required).
- **List Integrations** — returns the static list of 78 supported integration slugs.

Real API failures are never silently swallowed: a `success: false` response or a
top-level `status: "failed"` is surfaced as an n8n error (`NodeApiError`) so your
workflow can branch on failure.

## Prerequisites

- A NukeAPI account (https://nukeapi.com).
- An API key from the NukeAPI dashboard → **API Keys** (`nk_live_…`).
- At least one integration connected in the dashboard (the keys/credentials for each
  third-party tool live encrypted in NukeAPI, never in n8n).

## Install

### Option A — as a published dependency (recommended)

Inside your n8n project (or the container where n8n runs):

```bash
npm install n8n-nodes-nukeapi
```

Then restart n8n. The node appears under **NukeAPI**.

### Option B — local development (symlink)

```bash
cd n8n-nodes-nukeapi
npm install
npm run build

# link it globally, then into your n8n project:
npm link
cd /path/to/your/n8n/project
npm link n8n-nodes-nukeapi
```

### Option C — copy into n8n custom directory

```bash
# n8n reads custom nodes from ~/.n8n/custom/
cp -r n8n-nodes-nukeapi ~/.n8n/custom/
```

For Docker, mount the built package into the custom-extensions path and restart n8n.

## Add the credential

1. Open **Credentials → New** and search for **NukeAPI Api**.
2. Paste your **API Key** (`nk_live_…`) from the NukeAPI dashboard.
3. Set **Base URL** (defaults to `https://nukeapi.dev`).
4. Save, then select the credential on the NukeAPI node.

The credential has a built-in **connection test** (verifies the Base URL is reachable
via the public `/api/status` endpoint). The API key itself is validated at execution
time against the authenticated `/api/v1/*` routes.

## Operations

### Delete User

| Field | Notes |
|---|---|
| Subject Email | (required) email of the user to delete everywhere. |
| Integrations | Multi-select. **Leave empty to delete across all of your connected integrations.** Selecting specific slugs restricts the run to those. |
| Subject External ID | Optional secondary/external ID for the subject. |
| Webhook URL | Optional `https://` URL. NukeAPI POSTs a signed completion notification there when the deletion finishes. |

On success the node returns the API `data` object (one item per input item):

```json
{
  "requestId": "uuid",
  "status": "completed",
  "results": [
    { "integration": "stripe", "status": "success", "message": "Deleted 1 Stripe customer(s)", "durationMs": 420 }
  ],
  "startedAt": "…", "completedAt": "…", "elapsedMs": 890,
  "auditSignature": "hex-hmac-sha256…",
  "usage": { "plan": "startup", "used": 41, "limit": 200, "remaining": 159, "overageRate": 0.5 }
}
```

### Get Request

Pass a **Request ID** (from a prior Delete User call) to fetch its current status.

### Get Status

Public system health check — no credential needed beyond selecting it (the key is
simply ignored for this route).

### List Integrations

Returns `{ "integrations": ["stripe", "mailchimp", …] }` — the 78 supported slugs.

## Plan-gated behavior

- **Integrations left empty** → NukeAPI deletes across *all* integrations you have
  connected in the dashboard (respecting your plan's integration limit).
- Deletion volume is metered per your NukeAPI plan (Sandbox / Startup / Business /
  Enterprise). Exceeding the monthly allowance returns a `402` from the API, which
  surfaces as an n8n error.
- Authentication/authorization failures surface as `401`/`403`; rate limits as `429`.

## Build & verify (contributors)

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsc -> dist/ (+ copies nukeapi.svg)
```

## Publish

This package is published to npm as `n8n-nodes-nukeapi`:

```bash
npm version patch      # or minor/major
npm publish --access public
```

`package.json` is configured for n8n auto-discovery: the `n8n.nodes` (and
`n8n.credentials`) arrays point at the compiled `dist/` files, `files` ships only
`dist/`, and `n8n-workflow` is a runtime `dependency`. After publishing, users
install with `npm install n8n-nodes-nukeapi`.

MIT — Built by Lakhu Studio.
