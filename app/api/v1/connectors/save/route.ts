import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { encryptJSON } from "@/lib/security/crypto";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import { isCatalogIntegration, isRegisteredIntegration } from "@/lib/connectors/index";
import { CONNECTOR_META } from "@/lib/connectors/meta";
import { getUsableIntegrationSet } from "@/lib/connectors/flags";
import { validateSqlIdentifier } from "@/lib/connectors/engine/sql";
import { getPlanForUser } from "@/lib/engine/metering";
import { getMaxIntegrations, isIntegrationAllowed } from "@/lib/constants/compliance";
import type { Integration } from "@/types/connector";
import type { ConnectorSaveBody } from "@/types/api";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const body = (await req.json().catch(() => ({}))) as ConnectorSaveBody;
  const integration = (body.integration ?? "").trim();
  const creds = body.credentials ?? {};

  if (!isCatalogIntegration(integration)) {
    return errorResponse("INVALID_INTEGRATION", `Unknown integration: ${integration}`, 400);
  }

  // Owner availability gate: disabled/hidden/maintenance connectors cannot be connected.
  const usableSet = await getUsableIntegrationSet();
  if (!usableSet.has(integration)) {
    return errorResponse(
      "CONNECTOR_DISABLED",
      `"${integration}" is currently disabled by the administrator`,
      403,
    );
  }

  // Catalog-only ("coming soon") connectors have no delete executor yet.
  if (!isRegisteredIntegration(integration)) {
    return errorResponse(
      "CONNECTOR_NOT_LIVE_YET",
      `"${integration}" is on the roadmap but has no live delete executor yet — request it at hello@nukeapi.dev`,
      403,
    );
  }

  const required = CONNECTOR_META[integration as Integration].required ?? [];
  for (const field of required) {
    if (!creds[field] || typeof creds[field] !== "string" || !creds[field].trim()) {
      return errorResponse("MISSING_FIELD", `Missing credential field: ${field}`, 400);
    }
  }

  if (integration === "postgresql") {
    if (!validateSqlIdentifier(creds.table_name) || !validateSqlIdentifier(creds.email_column)) {
      return errorResponse("INVALID_IDENTIFIER", "table_name and email_column must be valid SQL identifiers", 400);
    }
  }

  const plan = await getPlanForUser(user.id);
  if (!isIntegrationAllowed(plan, integration as Integration)) {
    return errorResponse("INTEGRATION_NOT_ALLOWED", `Your plan (${plan}) does not permit "${integration}"`, 403);
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
        `Your plan (${plan}) allows up to ${max} integrations. Remove one to add "${integration}".`,
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
