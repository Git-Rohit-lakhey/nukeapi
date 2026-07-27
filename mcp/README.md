# NukeAPI MCP Server

An installable **Model Context Protocol (MCP)** server that exposes NukeAPI's
user-deletion API as tools a chat agent (Claude Desktop, Cursor, Claude Code,
etc.) can call. It is a thin, dependency-light client over the REST API — it
never touches credentials or the database directly, so the product's security
model stays intact.

## What it gives an agent

| Tool | Auth | Purpose |
|------|------|---------|
| `nuke_delete_user` | API key | Delete a user's data across one or more connected integrations. Returns per-integration status + audit signature. Omit `integrations` to fan out across ALL connected integrations. |
| `nuke_get_request` | API key | Look up a deletion request's status by `requestId`. |
| `nuke_status` | public | Check live system health (API, DB, rate limiter, integrations). |
| `nuke_list_integrations` | public | List every integration name NukeAPI supports (the 78-integration catalog). Use to discover valid `integrations` slugs before calling `nuke_delete_user`. |

> **Single source of truth:** the integration list is imported directly
> from `types/connector.ts` (`ALL_INTEGRATIONS`), so it always matches the
> product's full connector catalog (78 entries). There is nothing to
> keep in sync manually — adding or removing a connector in
> `types/connector.ts` automatically updates this MCP server on next run.

## Configuration (env vars)

| Var | Required | Default | Description |
|-----|----------|---------|-------------|
| `NUKEAPI_BASE_URL` | no | `https://nukeapi.dev` | Base URL of your NukeAPI instance. |
| `NUKEAPI_API_KEY` | yes (for `nuke_delete_user` / `nuke_get_request`) | — | A NukeAPI API key (`nk_live_...` / `nk_test_...`) from your dashboard's `/keys` page. Public tools (`nuke_status`, `nuke_list_integrations`) work without it. |

The transport is **stdio** — the server reads JSON-RPC messages from stdin and
writes them to stdout. It is a pure client over the REST API and never touches
credentials or the database; all auth, encryption, rate limiting, and plan
limits are enforced by the NukeAPI server exactly as they are for direct API
callers.

## Install / run

The server runs with `tsx` (already a dev dependency). From the repo root:

```bash
NUKEAPI_BASE_URL=https://nukeapi.dev \
NUKEAPI_API_KEY=nk_test_xxx \
npm run mcp
```

`npm run mcp` is equivalent to `npx tsx mcp/server.ts`. (It blocks on stdio;
run it as a managed subprocess from your MCP client — don't run it
interactively.)

Only `nuke_delete_user` and `nuke_get_request` require a key. If the key is
missing, those tools return a clear error instead of making the call; the
public tools work without it.

## Wire it into an agent

### Claude Desktop

Copy the contents of `mcp/claude_desktop_config.json` into your
`claude_desktop_config.json`, then:

1. Replace `/ABSOLUTE/PATH/TO/nukeapi/mcp/server.ts` with the real absolute
   path to this file.
2. Set `NUKEAPI_BASE_URL` to your instance (e.g. `https://nukeapi.dev`).
3. Set `NUKEAPI_API_KEY` to a real key from your NukeAPI dashboard (`/keys`).

Restart Claude Desktop. The four tools appear under the `nukeapi` server.

Example `claude_desktop_config.json` entry:

```json
{
  "mcpServers": {
    "nukeapi": {
      "command": "npx",
      "args": ["-y", "tsx", "/ABSOLUTE/PATH/TO/nukeapi/mcp/server.ts"],
      "env": {
        "NUKEAPI_BASE_URL": "https://nukeapi.dev",
        "NUKEAPI_API_KEY": "nk_test_replace_me"
      }
    }
  }
}
```

### Cursor

Add a `.cursor/mcp.json` at the repo root (Cursor reads it automatically):

```json
{
  "mcpServers": {
    "nukeapi": {
      "command": "npx",
      "args": ["-y", "tsx", "/ABSOLUTE/PATH/TO/nukeapi/mcp/server.ts"],
      "env": {
        "NUKEAPI_BASE_URL": "https://nukeapi.dev",
        "NUKEAPI_API_KEY": "nk_test_replace_me"
      }
    }
  }
}
```

Reload the project in Cursor; the `nukeapi` server's four tools become
available. Adjust the absolute path and env values to your instance.

## Tool notes

### `nuke_delete_user`

- `subject_email` (required): the email of the user whose data should be deleted.
- `integrations` (optional): array of integration slugs, e.g.
  `["stripe", "mailchimp", "hubspot"]`. **Omit it to delete the user across
  ALL of your connected integrations** — the server fans the request out to
  every registered connector your account has enabled. When omitted, no
  `integrations` key is sent.
- `webhook` (optional): an HTTPS URL NukeAPI notifies on completion.

Returns HTTP `200` (completed), `207` (partial — some integrations failed but
the request still succeeded), or `500` (failed). Non-2xx and `success:false`
responses are surfaced as MCP tool errors with the server's message and body.

### `nuke_list_integrations`

Returns the 78 integration slugs from `types/connector.ts` at runtime, so an
agent can discover valid connector names dynamically before calling
`nuke_delete_user`.

## Notes

- The integration list is imported directly from `types/connector.ts`
  (`ALL_INTEGRATIONS`) — it is the single source of truth and never needs
  manual syncing. The `nuke_list_integrations` tool also exposes it at
  runtime so an agent can discover valid connector slugs dynamically.
- The server only relays to the REST API, so rate limits, plan limits, and
  encrypted credential storage all still apply exactly as they do for direct
  API callers.
