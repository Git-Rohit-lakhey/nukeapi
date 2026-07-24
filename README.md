# NukeAPI

**One API call deletes a user everywhere.** NukeAPI is a developer-first
GDPR / CCPA / LGPD user-deletion API. Send an authenticated request with a
user's email; NukeAPI fans it out in parallel across every integration you've
connected (Stripe, Mailchimp, HubSpot, Intercom, Supabase, and **78**
integrations total), deletes that user's data in each one, and returns a
structured per-integration result plus a cryptographically signed PDF audit
trail proving what happened, when, and for whom.

> Core promise: "One API call deletes a user everywhere" is *real* — genuine
> parallel calls to each connector's real delete endpoint, with per-integration
> success / failure / skip status. No simulated responses.

## Client libraries

NukeAPI ships three finished, ready-to-use client packages:

### TypeScript SDK — `@nukeapi/sdk`

Dependency-free, ESM-first, TypeScript strict. Wraps the API-key-authenticated
REST surface with built-in retry/backoff and honest error typing.

```bash
npm install @nukeapi/sdk
```

```ts
import { NukeAPI, NukeAPIError } from "@nukeapi/sdk";

const nuke = new NukeAPI({
  apiKey: process.env.NUKEAPI_KEY!, // "nk_live_..." or "nk_test_..."
  // baseUrl defaults to https://app.nukeapi.com
});

const result = await nuke.deleteUser({
  subject_email: "user@example.com",
  // Omit `integrations` to delete across ALL connected integrations.
  integrations: ["stripe", "mailchimp"],
  webhook: "https://my-app.example.com/nukeapi-webhook", // optional signed callback
});

console.log(result.status);        // "completed" | "partial" | "failed"
console.log(result.auditSignature); // HMAC-SHA256 over the result
```

Methods: `deleteUser({ subject_email, integrations?, subject_external_id?, webhook? })`,
`getRequest(id)`, `getStatus()`. See [`sdk/README.md`](sdk/README.md).

### n8n community node — `n8n-nodes-nukeapi`

Adds NukeAPI as a node in your n8n workflows with four operations:
**Delete User**, **Get Request**, **Get Status**, **List Integrations**.
See [`n8n-nodes-nukeapi/README.md`](n8n-nodes-nukeapi/README.md).

### MCP server — `mcp/`

A stdio Model Context Protocol server that exposes NukeAPI to chat agents
(Claude Desktop, Cursor, Claude Code). Four tools: `nuke_delete_user`
(integrations optional = delete across ALL connected), `nuke_get_request`,
`nuke_status`, `nuke_list_integrations`.

```bash
NUKEAPI_BASE_URL=http://localhost:3000 \
NUKEAPI_API_KEY=nk_test_xxx \
npm run mcp
```

Claude Desktop `claude_desktop_config.json` (see
[`mcp/claude_desktop_config.json`](mcp/claude_desktop_config.json)):

```json
{
  "mcpServers": {
    "nukeapi": {
      "command": "npx",
      "args": ["-y", "tsx", "/ABSOLUTE/PATH/TO/nukeapi/mcp/server.ts"],
      "env": {
        "NUKEAPI_BASE_URL": "https://app.nukeapi.com",
        "NUKEAPI_API_KEY": "nk_test_replace_me"
      }
    }
  }
}
```

See [`mcp/README.md`](mcp/README.md).

## Live endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/delete-user` | Bearer `nk_live_…` / `nk_test_…` | Delete a user across integrations. |
| `GET`  | `/api/v1/status/{id}` | Bearer API key | Fetch a deletion request's status. |
| `GET`  | `/api/status` | public | Public system health check. |

## Security posture

- **AES-256-GCM credential encryption** — connector credentials (Stripe secret
  keys, HubSpot/Intercom tokens, Supabase service-role keys) are encrypted
  server-side with a server-only key before they ever reach the database.
  The browser never writes them and never sees the key.
- **HMAC-SHA256 audit signing** — every deletion result is signed over a
  canonical representation (request id, subject email, status, timestamps,
  sorted per-integration results). The signature is stored on the request and
  embedded in the PDF audit trail, so it is independently re-verifiable.
- **Real parallel deletes** — the orchestrator runs every connector via
  `Promise.allSettled`, with each call wrapped so one failure can't crash the
  others, and no result is ever silently dropped from the audit trail.
- **Atomic usage metering** — deletion counts increment via a Postgres RPC
  (`increment_usage`), never a read-then-write, so concurrent calls can't
  undercount.

## Project docs

- [`SETUP.md`](SETUP.md) — install, environment, migrations, deploy, client libraries.
- [`PLAN.md`](PLAN.md) — living build plan & session handoff snapshot.
- [`CHANGELOG.md`](CHANGELOG.md) — what shipped, when, and why.

Built by Lakhu Studio.
