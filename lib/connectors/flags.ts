import "server-only";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { CONNECTOR_META } from "@/lib/connectors/meta";

/**
 * Per-connector availability flags, controlled by the owner in /owner.
 * A connector is usable by end users ONLY when its flag is enabled AND not
 * hidden AND not in maintenance AND the user's plan allows it. Reads/writes
 * go through the service-role client; the database is the single source of
 * truth (the `connector_flags` table, seeded in migration 010).
 * `enabledByDefault` in CONNECTOR_META is only a fallback before the table
 * exists (e.g. fresh checkout, tests) — never the authority in production.
 */

export interface ConnectorFlag {
  integration: string;
  enabled: boolean;
  maintenance: boolean;
  hidden: boolean;
  category: string;
  toggled_by: string | null;
  toggled_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Fallback flags synthesized from CONNECTOR_META when the table is unreachable. */
function fallbackFlags(): ConnectorFlag[] {
  return Object.values(CONNECTOR_META).map((m) => ({
    integration: m.key,
    enabled: m.enabledByDefault,
    maintenance: false,
    hidden: false,
    category: m.category,
    toggled_by: null,
    toggled_at: null,
    note: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  }));
}

/** Read all connector flags from the database (falls back to meta defaults). */
export async function getAllConnectorFlags(): Promise<ConnectorFlag[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("connector_flags")
      .select("*")
      .order("integration");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return fallbackFlags();
    return data as ConnectorFlag[];
  } catch (e) {
    console.warn("[flags] connector_flags read failed, using meta defaults:", (e as Error).message);
    return fallbackFlags();
  }
}

/** Set of currently-enabled integrations (regardless of maintenance). */
export async function getEnabledIntegrationSet(): Promise<Set<string>> {
  const flags = await getAllConnectorFlags();
  return new Set(flags.filter((f) => f.enabled).map((f) => f.integration));
}

/**
 * Set of integrations actually USABLE by end users: enabled AND not hidden
 * AND not in maintenance. A hidden connector is admin-only — it never reaches
 * the client catalog or the public site. A connector in maintenance is treated
 * exactly like a disabled one by end users.
 */
export async function getUsableIntegrationSet(): Promise<Set<string>> {
  const flags = await getAllConnectorFlags();
  return new Set(
    flags
      .filter((f) => f.enabled && !f.hidden && !f.maintenance)
      .map((f) => f.integration),
  );
}

/** Alias used by marketing/docs/landing to mean "publicly visible". */
export const getVisibleIntegrationSet = getUsableIntegrationSet;

/** Set of integrations that are hidden (admin-only) regardless of enabled. */
export async function getHiddenIntegrationSet(): Promise<Set<string>> {
  const flags = await getAllConnectorFlags();
  return new Set(flags.filter((f) => f.hidden).map((f) => f.integration));
}

/** Flip a connector's availability flag and write an audit row. */
export async function setConnectorFlag(
  integration: string,
  enabled: boolean,
  actorId: string | null,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("connector_flags")
    .update({
      enabled,
      toggled_by: actorId,
      toggled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("integration", integration);
  if (error) throw new Error(`connector_flag update failed: ${error.message}`);

  // Always keep a paper trail of who flipped what, when (best-effort).
  try {
    await admin.from("admin_audit").insert({
      action: "connector_flag_toggle",
      actor_id: actorId,
      target: integration,
      before: { enabled: !enabled },
      after: { enabled },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[flags] admin_audit insert failed (flag toggle):", e);
  }
}

/** Put a connector into (or take it out of) maintenance mode. */
export async function setConnectorMaintenance(
  integration: string,
  maintenance: boolean,
  actorId: string | null,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("connector_flags")
    .update({
      maintenance,
      toggled_by: actorId,
      toggled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("integration", integration);
  if (error) throw new Error(`connector_maintenance update failed: ${error.message}`);

  try {
    await admin.from("admin_audit").insert({
      action: "connector_maintenance_toggle",
      actor_id: actorId,
      target: integration,
      before: { maintenance: !maintenance },
      after: { maintenance },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[flags] admin_audit insert failed (maintenance toggle):", e);
  }
}

/** Hide or reveal a connector from the client catalog / marketing site. */
export async function setConnectorHidden(
  integration: string,
  hidden: boolean,
  actorId: string | null,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("connector_flags")
    .update({
      hidden,
      toggled_by: actorId,
      toggled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("integration", integration);
  if (error) throw new Error(`connector_hidden update failed: ${error.message}`);

  try {
    await admin.from("admin_audit").insert({
      action: "connector_hidden_toggle",
      actor_id: actorId,
      target: integration,
      before: { hidden: !hidden },
      after: { hidden },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[flags] admin_audit insert failed (hidden toggle):", e);
  }
}

/**
 * Pure split of a requested integration list by an enabled set. No IO — used
 * by the routes and covered by unit tests.
 */
export function resolveEnabled(
  requested: string[],
  enabledSet: Set<string>,
): { enabled: string[]; disabled: string[] } {
  const enabled: string[] = [];
  const disabled: string[] = [];
  for (const i of requested) {
    if (enabledSet.has(i)) enabled.push(i);
    else disabled.push(i);
  }
  return { enabled, disabled };
}
