# @nukeapi/sdk

Official TypeScript SDK for [NukeAPI](https://app.nukeapi.com) — the GDPR / CCPA / LGPD user-deletion API. One call fans a deletion out across every integration you've connected, and returns a per-integration result plus a cryptographic audit signature.

- **Zero runtime dependencies.** Uses the global `fetch` (Node 18+ and modern browsers).
- **ESM-first**, TypeScript strict mode, ships `.js` + `.d.ts` in `dist/`.
- **Honest errors.** Throws a typed `NukeAPIError` on any non-2xx response or network failure — it never pretends success when the server reported failure.

## Install

```bash
npm install @nukeapi/sdk
```

## Quickstart

```ts
import { NukeAPI, NukeAPIError } from "@nukeapi/sdk";

const nuke = new NukeAPI({
  apiKey: process.env.NUKEAPI_KEY!, // "nk_live_..." or "nk_test_..."
  // baseUrl defaults to https://app.nukeapi.com
  // use baseUrl: "http://localhost:3000" in development
});

async function main() {
  try {
    const result = await nuke.deleteUser({
      subject_email: "user@example.com",
      // Omit `integrations` to delete across ALL connected integrations.
      integrations: ["stripe", "mailchimp"],
      // Optional: your own internal id for the subject (echoed back in status).
      subject_external_id: "usr_123",
      // Optional: signed POST fired to this HTTPS URL when the job completes.
      webhook: "https://my-app.example.com/nukeapi-webhook",
    });

    console.log(result.status); // "completed" | "partial" | "failed"
    console.log(result.requestId);
    console.log(result.auditSignature); // HMAC-SHA256 over the result
    console.log(result.usage); // { plan, used, limit, remaining, overageRate? }

    for (const r of result.results) {
      console.log(r.integration, r.status, r.message, r.durationMs);
    }
  } catch (err) {
    if (err instanceof NukeAPIError) {
      console.error(err.status); // HTTP status (0 for network errors)
      console.error(err.code); // e.g. "UNAUTHORIZED", "RATE_LIMITED", "HTTP_402"
      console.error(err.message);
      console.error(err.retryAfter); // seconds, from Retry-After header
    }
    throw err;
  }
}

main();
```

### Response shape (`deleteUser`)

`deleteUser` resolves to `DeleteUserResponse["data"]`:

| Field | Type | Notes |
|---|---|---|
| `requestId` | `string` | UUID of the deletion request. |
| `status` | `"completed" \| "partial" \| "failed"` | `partial` is **not** thrown — inspect it. |
| `results` | `ConnectorResult[]` | `{ integration, status, message, error?, durationMs }`. |
| `startedAt` / `completedAt` | `string` | ISO-8601 timestamps. |
| `elapsedMs` | `number` | Total wall-clock time. |
| `auditSignature` | `string` | HMAC-SHA256 hex signature. |
| `usage` | `UsageInfo` | `{ plan, used, limit, remaining, overageRate? }`. |

> **Honesty note:** a `partial` outcome (HTTP 207) is returned as a normal resolved value with `success: true`. A `failed` outcome (HTTP 500) raises `NukeAPIError`. Check `result.results[].status` to see which integrations failed or were skipped.

## `deleteUser` parameters

`deleteUser` accepts a `DeleteUserParams` object:

| Field | Type | Notes |
|---|---|---|
| `subject_email` | `string` | **Required.** RFC-valid email of the user to delete. |
| `integrations` | `Integration[]` | **Optional.** When **omitted or empty**, the server fans the deletion out across **all** integrations that (a) your plan allows and (b) you have enabled/connected in the dashboard. Pass a list to restrict to specific integrations. |
| `subject_external_id` | `string` | **Optional.** Your own internal id for the subject; it is stored on the request and echoed back by `getRequest`. |
| `webhook` | `string` | **Optional.** An `https://` URL. When provided, the server fires a **signed `POST`** to it when the deletion completes (SSRF-validated server-side — it will not be called if it resolves to an internal/private address). Omit to skip the notification. |

```ts
const result = await nuke.deleteUser({
  subject_email: "user@example.com",
  // No `integrations` → delete across every connected, plan-allowed integration.
  subject_external_id: "usr_123",
  webhook: "https://my-app.example.com/nukeapi-webhook",
});
```

## Error handling

All failures throw `NukeAPIError`. Read `.status`, `.code`, and `.message`:

| HTTP | `code` (typical) | Meaning |
|---|---|---|
| 401 | `UNAUTHORIZED` | Missing / invalid API key. |
| 400 | `BAD_REQUEST` | Malformed body or invalid email. |
| 402 | (quota) | Deletion quota exceeded. |
| 403 | (forbidden) | Integration not on your plan / connector disabled. |
| 429 | (rate limited) | Slow down; `err.retryAfter` has the delay in seconds. |
| 500 | (server) | The deletion failed server-side. |
| 0 | `NETWORK_ERROR` | DNS / connection / timeout — no HTTP response. |

The SDK automatically retries on network errors, `429`, and `5xx` with exponential backoff (2 retries by default, honors `Retry-After`).

## Get a request's status

```ts
const status = await nuke.getRequest(result.requestId);
// status: { requestId, status, subjectEmail, integrationsRequested,
//           integrationsCompleted, integrationsFailed, createdAt,
//           completedAt, auditSignature }
```

Throws `NukeAPIError` with code `NOT_FOUND` (HTTP 404) if the id is unknown.

## System status (public)

```ts
const sys = await nuke.getStatus();
// sys: { status: "operational" | "degraded", checks: [{ name, ok, detail }] }
```

No API key is required for this endpoint.

## Listing integrations

```ts
import { NukeAPI, type Integration } from "@nukeapi/sdk";

console.log(NukeAPI.integrations); // Integration[]
// or import the list directly:
import { INTEGRATIONS } from "@nukeapi/sdk";
```

`Integration` is a string-literal union of every supported integration (e.g. `"stripe"`, `"mailchimp"`, `"hubspot"`, `"postgresql"`, …).

## TypeScript notes

- The package is ESM (`"type": "module"`). Use `import { NukeAPI } from "@nukeapi/sdk"`.
- Types are re-exported from the package root: `import { NukeAPI, NukeAPIError, type Integration, type ConnectorResult } from "@nukeapi/sdk"`.
- Requires TypeScript `>=4.7` to consume the `exports` map with bundled types (any modern version is fine). Node `>=18` at runtime (for global `fetch`).

## What the SDK does NOT do

Connector-credential management (saving your Stripe secret key, Supabase service-role key, etc.) and API-key creation are **session / cookie** flows performed in the NukeAPI dashboard. They are intentionally **not** part of this SDK — the SDK only wraps the API-key-authenticated REST surface (`delete-user`, `status/{id}`, and the public `status` endpoint).

## Build & publish

The package is dependency-free (only `typescript` as a devDependency) and ships compiled ESM + types in `dist/`.

```bash
# Type-check only
npm run typecheck

# Compile to dist/ (emits .js + .d.ts + maps)
npm run build

# Publish to npm (requires an npm login with publish rights to @nukeapi)
npm publish
```

`dist/` is the only published artifact (`"files": ["dist"]`). Nothing outside `dist/` reaches the registry. The package is verified clean with both `npm run build` and `npm run typecheck` before each release.
