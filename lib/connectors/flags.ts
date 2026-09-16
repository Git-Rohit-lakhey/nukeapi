import "server-only";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { ApiError } from "@/lib/engine/errors";

/**
 * Per-connector availability flags, controlled by the owner in the admin UI.
 * A connector is usable by end users ONLY when its flag is enabled AND the
 * user's plan allows it. Reads/writes go through service-role server routes;
 * the database is the single source of truth (the `connector_flags` table,
 * seeded in migration 010). `enabledByDefault` in CONNECTOR_META is only a UI
 * fallback before the live flag state is fetched.
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

/** Read all connector flags from the database. */
export async function getAllConnectorFlags(): Promise<ConnectorFlag[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("connector_flags")
    .select("*")
    .order("integration");
  if (error) throw new Error(`connector_flags read failed: ${error.message}`);
  return (data ?? []) as ConnectorFlag[];
}

/** Set of currently-enabled integrations (regardless of maintenance). */
export async function getEnabledIntegrationSet(): Promise<Set<string>> {
  const flags = await getAllConnectorFlags();
  return new Set(flags.filter((f) => f.enabled).map((f) => f.integration));
}

/**
 * Set of integrations actually USABLE by end users: enabled AND not hidden AND
 * not in maintenance. A hidden connector is admin-only — it never reaches the
 * client catalog or the public site, and cannot be run by normal users until
 * the owner releases it (which flips enabled=true, hidden=false). A connector
 * in maintenance is treated exactly like a disabled one by end users.
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
 * Per-user "custom" grants: the owner enables a BUILT connector for a single
 * enterprise user, without making it globally live. Returns the set of
 * integration keys granted to the given user.
 */
export async function getCustomGrantsForUser(userId: string): Promise<Set<string>> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("custom_connector_grants")
    .select("integration")
    .eq("user_id", userId);
  if (error) throw new Error(`custom_connector_grants read failed: ${error.message}`);
  return new Set((data ?? []).map((r) => r.integration as string));
}

/** Grant a connector to a specific user (owner action, audited). */
export async function grantCustomIntegration(
  integration: string,
  userId: string,
  actorId: string | null,
): Promise<void> {
  // Custom connectors are an Enterprise-only feature (pricing-page claim).
  // Enforce the plan here so the rule holds no matter which admin path grants.
  const { getPlanForUser } = await import("@/lib/engine/metering");
  const plan = await getPlanForUser(userId);
  const isEnterprisePlan =
    plan === "enterprise" || plan === "enterprise_yearly";
  if (!isEnterprisePlan) {
    throw new ApiError(
      "PLAN_REQUIRED",
      "Custom connectors are available to Enterprise customers only",
      403,
    );
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("custom_connector_grants").upsert(
    {
      user_id: userId,
      integration,
      granted_by: actorId,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,integration" },
  );
  if (error) throw new Error(`custom grant failed: ${error.message}`);
  try {
    await admin.from("admin_audit").insert({
      action: "custom_connector_grant",
      actor_id: actorId,
      target: integration,
      before: { granted: false },
      after: { granted: true, user_id: userId },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[flags] admin_audit insert failed (custom grant):", e);
  }
}

/** Revoke a connector grant from a specific user (owner action, audited). */
export async function revokeCustomIntegration(
  integration: string,
  userId: string,
  actorId: string | null,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("custom_connector_grants")
    .delete()
    .eq("user_id", userId)
    .eq("integration", integration);
  if (error) throw new Error(`custom revoke failed: ${error.message}`);
  try {
    await admin.from("admin_audit").insert({
      action: "custom_connector_revoke",
      actor_id: actorId,
      target: integration,
      before: { granted: true, user_id: userId },
      after: { granted: false },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[flags] admin_audit insert failed (custom revoke):", e);
  }
}

/** List every active custom grant (owner UI). */
export async function getAllCustomGrants(): Promise<
  Array<{ user_id: string; integration: string; granted_by: string | null; created_at: string }>
> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("custom_connector_grants")
    .select("user_id, integration, granted_by, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`custom grants list failed: ${error.message}`);
  return (data ?? []) as Array<{
    user_id: string;
    integration: string;
    granted_by: string | null;
    created_at: string;
  }>;
}

/**
 * Pure split of a requested integration list by an enabled set. No IO — used
 * by the routes and covered by a unit test (test/integration.test.ts).
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
