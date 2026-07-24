import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { errorResponse } from "@/lib/engine/errors";
import {
  getUsableIntegrationSet,
  getCustomGrantsForUser,
  getAllConnectorFlags,
} from "@/lib/connectors/flags";
import { ALL_CONNECTOR_META } from "@/lib/connectors/meta";
import { isIntegrationAllowed } from "@/lib/constants/compliance";
import { getPlanForUser } from "@/lib/engine/metering";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Session-authenticated catalog for the logged-in user. Merges:
 *  - the globally VISIBLE set, filtered by the user's plan,
 *  - connectors in MAINTENANCE (shown but not connectable), and
 *  - any per-user CUSTOM grants the owner has enabled for this user.
 * Hidden (admin-only) connectors that are NOT custom-granted for this user are
 * omitted entirely — they simply don't exist from the client's perspective.
 * Custom-granted connectors bypass the plan whitelist (explicit owner grant).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);

  const plan = await getPlanForUser(user.id);
  const visible = await getUsableIntegrationSet();
  const custom = await getCustomGrantsForUser(user.id);
  const flags = await getAllConnectorFlags();
  const flagMap = new Map(flags.map((f) => [f.integration, f]));

  // Which connectors does this user already have credentials for?
  const admin = getSupabaseAdmin();
  const { data: creds } = await admin
    .from("connector_credentials")
    .select("integration")
    .eq("user_id", user.id)
    .eq("is_active", true);
  const connected = new Set((creds ?? []).map((c: { integration: string }) => c.integration));

  const integrations = ALL_CONNECTOR_META.filter((m) => {
    const f = flagMap.get(m.key);
    const isVisible = !!f && f.enabled && !f.hidden && !f.maintenance;
    const isMaint = !!f && f.enabled && f.maintenance;
    const isCustom = custom.has(m.key);
    return isVisible || (isMaint && isIntegrationAllowed(plan, m.key)) || isCustom;
  }).map((m) => {
    const f = flagMap.get(m.key);
    const isCustom = custom.has(m.key);
    const isVisible = !!f && f.enabled && !f.hidden && !f.maintenance;
    const isMaint = !!f && f.enabled && f.maintenance;
    return {
      key: m.key,
      label: m.label,
      category: m.category,
      enabled: isVisible,
      hidden: !isVisible && !isCustom,
      maintenance: isMaint,
      custom: isCustom,
      planAllowed: isCustom || isIntegrationAllowed(plan, m.key),
      connected: connected.has(m.key),
    };
  });

  return NextResponse.json({ success: true, data: { plan, integrations } });
}
