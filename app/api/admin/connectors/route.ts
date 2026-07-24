import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/db/supabase";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import {
  getAllConnectorFlags,
  setConnectorFlag,
  setConnectorMaintenance,
  setConnectorHidden,
} from "@/lib/connectors/flags";
import { CONNECTOR_META, type ConnectorMeta } from "@/lib/connectors/meta";
import { isRegisteredIntegration } from "@/lib/connectors/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner-only check, mirroring the /owner page and OWNER_EMAILS allowlist. */
function isOwner(email: string): boolean {
  const ownerEmails = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return ownerEmails.includes(email.toLowerCase());
}

/**
 * GET — list every connector with its current enabled + maintenance state.
 * Owner only.
 */
export const GET = withErrorHandler(async () => {
  const user = await getSessionUser();
  if (!user || !isOwner(user.email)) {
    return errorResponse("FORBIDDEN", "Admin only", 403);
  }
  const flags = await getAllConnectorFlags();
  const integrations = flags.map((f) => {
    const meta = CONNECTOR_META[f.integration as keyof typeof CONNECTOR_META] as
      | ConnectorMeta
      | undefined;
    return {
      key: f.integration,
      label: meta?.label ?? f.integration,
      tag: meta?.tag ?? f.category,
      category: f.category,
      enabled: f.enabled,
      hidden: f.hidden,
      maintenance: f.maintenance,
      note: meta?.note ?? null,
      toggledAt: f.toggled_at,
    };
  });
  return NextResponse.json({ success: true, data: { integrations } });
});

/**
 * PATCH — flip a connector's availability / visibility / maintenance flag. Owner only.
 * Body: { integration: string, enabled?: boolean, hidden?: boolean, maintenance?: boolean }.
 * The client "Live" toggle sends enabled and hidden together (enabled = !hidden).
 * At least one of the three must be supplied. Every change is audited.
 */
export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user || !isOwner(user.email)) {
    return errorResponse("FORBIDDEN", "Admin only", 403);
  }

  const body = (await req.json().catch(() => ({}))) as {
    integration?: string;
    enabled?: boolean;
    hidden?: boolean;
    maintenance?: boolean;
  };
  const integration = (body.integration ?? "").trim();

  if (!isRegisteredIntegration(integration)) {
    return errorResponse("INVALID_INTEGRATION", `Unknown integration: ${integration}`, 400);
  }

  const wantsEnabled = typeof body.enabled === "boolean";
  const wantsHidden = typeof body.hidden === "boolean";
  const wantsMaintenance = typeof body.maintenance === "boolean";
  if (!wantsEnabled && !wantsHidden && !wantsMaintenance) {
    return errorResponse(
      "INVALID_BODY",
      "Provide enabled, hidden, and/or maintenance as booleans",
      400,
    );
  }

  if (wantsEnabled) await setConnectorFlag(integration, body.enabled as boolean, user.id);
  if (wantsHidden) await setConnectorHidden(integration, body.hidden as boolean, user.id);
  if (wantsMaintenance)
    await setConnectorMaintenance(integration, body.maintenance as boolean, user.id);

  return NextResponse.json({
    success: true,
    data: {
      integration,
      enabled: wantsEnabled ? body.enabled : undefined,
      hidden: wantsHidden ? body.hidden : undefined,
      maintenance: wantsMaintenance ? body.maintenance : undefined,
    },
  });
});
