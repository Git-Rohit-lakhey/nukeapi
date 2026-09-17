import { NextResponse } from "next/server";
import { getAllConnectorFlags } from "@/lib/connectors/flags";
import { CONNECTOR_META } from "@/lib/connectors/meta";
import { isRegisteredIntegration } from "@/lib/connectors/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public availability of connectors (no auth). Returns which integrations are
 * currently enabled by the owner so the dashboard and marketing site can show
 * accurate "live / coming soon / maintenance" state. Contains no secrets.
 */
export async function GET() {
  const flags = await getAllConnectorFlags();
  const integrations = flags.map((f) => ({
    key: f.integration,
    label: CONNECTOR_META[f.integration as keyof typeof CONNECTOR_META]?.label ?? f.integration,
    category: f.category,
    enabled: f.enabled,
    hidden: f.hidden,
    maintenance: f.maintenance,
    visible: f.enabled && !f.hidden && !f.maintenance,
    usable: f.enabled && !f.hidden && !f.maintenance,
    // Owner intent (visible/usable) vs reality: only the 6 core integrations
    // have delete executors. Clients must AND these to decide "Live".
    runnable: isRegisteredIntegration(f.integration),
  }));
  return NextResponse.json({
    success: true,
    data: {
      integrations,
      count: integrations.filter((i) => i.visible).length,
    },
  });
}
