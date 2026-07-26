import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { encryptJSON } from "@/lib/security/crypto";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import { isRegisteredIntegration } from "@/lib/connectors/index";
import { CONNECTOR_META } from "@/lib/connectors/meta";
import { getUsableIntegrationSet, getCustomGrantsForUser } from "@/lib/connectors/flags";
import { validateSqlIdentifier } from "@/lib/connectors/engine/sql";
import { getPlanForUser } from "@/lib/engine/metering";
import { getMaxIntegrations, isIntegrationAllowed } from "@/lib/constants/compliance";
import type { Integration } from "@/types/connector";
import type { ConnectorSaveBody } from "@/types/api";

export const runtime = "nodejs";

/**
 * Server-side credential save (Section 6.1). The browser POSTs plaintext
 * credentials over the authenticated session; we encrypt with AES-256-GCM
 * here — the encryption key never reaches the client, and the DB never sees
 * plaintext.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const body = (await req.json().catch(() => ({}))) as ConnectorSaveBody;
  const integration = (body.integration ?? "").trim();
  const creds = body.credentials ?? {};

  if (!isRegisteredIntegration(integration)) {
    return errorResponse("INVALID_INTEGRATION", `Unknown integration: ${integration}`, 400);
  }

  // The owner can disable a connector (or put it into maintenance / hide it)
  // for rollout. A per-user custom grant from the owner overrides this.
  const usableSet = await getUsableIntegrationSet();
  const custom = await getCustomGrantsForUser(user.id);
  if (!usableSet.has(integration) && !custom.has(integration)) {
    return errorResponse(
      "CONNECTOR_DISABLED",
      `Connector "${integration}" is currently disabled, hidden, or in maintenance by the administrator`,
      403,
    );
  }

  const required = CONNECTOR_META[integration].required ?? [];
  for (const field of required) {
    if (!creds[field] || typeof creds[field] !== "string" || !creds[field].trim()) {
      return errorResponse("MISSING_FIELD", `Missing credential field: ${field}`, 400);
    }
  }

  // Extra validation for postgresql identifiers before we even store them.
  if (integration === "postgresql") {
    if (
      !validateSqlIdentifier(creds.table_name) ||
      !validateSqlIdentifier(creds.email_column)
    ) {
      return errorResponse(
        "INVALID_IDENTIFIER",
        "table_name and email_column must be valid SQL identifiers",
        400,
      );
    }
  }

  // Plan gate: free plan may only connect its fixed whitelist; all plans are
  // capped on how many integrations they may have connected at once.
  const plan = await getPlanForUser(user.id);
  if (!isIntegrationAllowed(plan, integration as Integration) && !custom.has(integration)) {
    return errorResponse(
      "INTEGRATION_NOT_ALLOWED",
      `Your plan (${plan}) does not permit the "${integration}" integration`,
      403,
    );
  }
  const max = getMaxIntegrations(plan);
  if (max !== Infinity) {
    const admin = getSupabaseAdmin();
    const { count } = await admin
      .from("connector_credentials")
      .select("integration", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true)
      .neq("integration", integration);
    const connected = count ?? 0;
    if (connected >= max) {
      return errorResponse(
        "INTEGRATION_LIMIT",
        `Your plan (${plan}) allows up to ${max} connected integrations. Remove one to add "${integration}".`,
        403,
      );
    }
  }

  const envelope = encryptJSON(creds);
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("connector_credentials").upsert(
    {
      user_id: user.id,
      integration,
      credentials: envelope,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,integration" },
  );

  if (error) return errorResponse("INTERNAL_ERROR", "Failed to save credentials", 500);
  return NextResponse.json({ success: true, data: { integration, saved: true } });
});
