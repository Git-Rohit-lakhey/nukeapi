import { NextResponse } from "next/server";
import { getAllConnectorFlags } from "@/lib/connectors/flags";
import { CONNECTOR_META } from "@/lib/connectors/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public availability of connectors (no auth). Returns which integrations are
 * currently enabled by the owner so the dashboard and marketing site can show
 * accurate "live / unavailable" state. Contains no secrets.
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
  }));
  return NextResponse.json({
    success: true,
    data: {
      integrations,
      count: integrations.filter((i) => i.visible).length,
    },
  });
}
