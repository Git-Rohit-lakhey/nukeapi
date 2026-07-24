/**
 * NukeAPI MCP server (stdio transport)
 * --------------------------------------
 * Exposes NukeAPI's deletion API as Model Context Protocol tools so an AI
 * agent (Claude Desktop, Cursor, Claude Code, etc.) can delete a user's data
 * across connected SaaS integrations on a developer's behalf.
 *
 * Run with:  npx tsx mcp/server.ts
 * (which is what the example configs invoke).
 *
 * Configuration (env vars):
 *   NUKEAPI_BASE_URL  Base URL of your NukeAPI instance.
 *                     Default: http://localhost:3000
 *   NUKEAPI_API_KEY   A NukeAPI API key (nk_live_... / nk_test_...).
 *                     Required for delete-user and get-request tools.
 *
 * This server is a thin, dependency-light client over the REST API. It never
 * touches credentials or the database directly — it just calls the same
 * endpoints an SDK would, keeping the security model intact.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ALL_INTEGRATIONS } from "../types/connector";

// Single source of truth: imported from types/connector.ts so the MCP
// server's integration list can never drift from the product's 78 integrations.
const INTEGRATION_ENUM = z.enum(ALL_INTEGRATIONS as unknown as [string, ...string[]]);

const BASE_URL = (process.env.NUKEAPI_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const API_KEY = process.env.NUKEAPI_API_KEY || "";

function authHeaders(): Record<string, string> {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
}

function requireApiKey(): { ok: true } | { ok: false; text: string } {
  if (!API_KEY) {
    return {
      ok: false,
      text: "NUKEAPI_API_KEY is not set. Add your NukeAPI API key to the MCP server's environment (nk_live_... or nk_test_...).",
    };
  }
  return { ok: true };
}

function asText(obj: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

function asError(text: string): { content: { type: "text"; text: string }[]; isError: true } {
  return { content: [{ type: "text", text }], isError: true };
}

const server = new McpServer({
  name: "nukeapi",
  version: "1.1.0",
});

// ---------------------------------------------------------------------------
// Tool: nuke_delete_user
// ---------------------------------------------------------------------------
server.tool(
  "nuke_delete_user",
  "Delete a user's data across connected SaaS integrations via the NukeAPI deletion API. " +
    "Runs real parallel deletes and returns per-integration success/failure plus an audit signature. " +
    "Use this when a user requests GDPR/CCPA/LGPD erasure. You can target specific integrations, or " +
    "omit the `integrations` argument entirely to delete the user across ALL of your connected " +
    "integrations (the server fans the request out to every registered connector your account has enabled).",
  {
    subject_email: z.email().describe("The email of the user whose data should be deleted."),
    integrations: z
      .array(INTEGRATION_ENUM)
      .optional()
      .describe(
        "Optional list of integrations to delete the user from, e.g. [\"stripe\", \"mailchimp\", \"hubspot\"]. " +
          "Omit this argument to delete the user across ALL of your connected integrations — the server will " +
          "fan the request out to every registered connector your account has enabled.",
      ),
    webhook: z
      .url()
      .optional()
      .describe("Optional HTTPS webhook to notify when the deletion completes."),
  },
  async ({ subject_email, integrations, webhook }) => {
    const check = requireApiKey();
    if (!check.ok) return asError(check.text);

    try {
      // Only include `integrations` when the caller actually supplies a
      // non-empty list. Omitting it (or passing an empty array) lets the server
      // fan the deletion out across all of the account's connected connectors —
      // we must NOT send a null/empty `integrations` key.
      const payload: Record<string, unknown> = { subject_email };
      if (integrations && integrations.length > 0) payload.integrations = integrations;
      if (webhook) payload.webhook = webhook;

      const res = await fetch(`${BASE_URL}/api/v1/delete-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        return asError(
          `NukeAPI responded with ${res.status}: ${json?.error?.message ?? "unknown error"}\n${JSON.stringify(json, null, 2)}`,
        );
      }
      return asText(json.data);
    } catch (err) {
      return asError(`Failed to reach NukeAPI at ${BASE_URL}: ${(err as Error).message}`);
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: nuke_get_request
// ---------------------------------------------------------------------------
server.tool(
  "nuke_get_request",
  "Look up the status of a previously submitted NukeAPI deletion request by its requestId. " +
    "Returns per-integration completed/failed lists, overall status, timestamps, and the audit signature.",
  {
    requestId: z.string().min(1).describe("The deletion request id returned by nuke_delete_user."),
  },
  async ({ requestId }) => {
    const check = requireApiKey();
    if (!check.ok) return asError(check.text);

    try {
      const res = await fetch(`${BASE_URL}/api/v1/status/${encodeURIComponent(requestId)}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        return asError(
          `NukeAPI responded with ${res.status}: ${json?.error?.message ?? "unknown error"}\n${JSON.stringify(json, null, 2)}`,
        );
      }
      return asText(json.data);
    } catch (err) {
      return asError(`Failed to reach NukeAPI at ${BASE_URL}: ${(err as Error).message}`);
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: nuke_status
// ---------------------------------------------------------------------------
server.tool(
  "nuke_status",
  "Check NukeAPI's live system health (API, database, rate limiter, and per-integration availability). " +
    "Public endpoint — no API key required.",
  {},
  async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/status`);
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        return asError(
          `NukeAPI status check failed with ${res.status}: ${json?.error?.message ?? "unknown error"}\n${JSON.stringify(json, null, 2)}`,
        );
      }
      return asText(json.data);
    } catch (err) {
      return asError(`Failed to reach NukeAPI at ${BASE_URL}: ${(err as Error).message}`);
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: nuke_list_integrations
// ---------------------------------------------------------------------------
server.tool(
  "nuke_list_integrations",
  "List every integration name NukeAPI supports (the 78-integration catalog). " +
    "Use this to discover valid integration slugs before calling nuke_delete_user, " +
    "so the `integrations` argument matches exactly. Public endpoint — no API key required.",
  {},
  async () => {
    try {
      return asText(ALL_INTEGRATIONS);
    } catch (err) {
      return asError(`Failed to enumerate integrations: ${(err as Error).message}`);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // Errors on stdio would corrupt the protocol stream; write to stderr only.
  process.stderr.write(`NukeAPI MCP server failed to start: ${(err as Error).message}\n`);
  process.exit(1);
});
