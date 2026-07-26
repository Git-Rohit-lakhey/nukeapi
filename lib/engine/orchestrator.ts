import "server-only";
import type { ConnectorResult, Integration } from "@/types/connector";
import { CONNECTORS, type ConnectorFn } from "@/lib/connectors/index";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { decryptJSON } from "@/lib/security/crypto";
import { writeAuditLogs } from "@/lib/audit/logger";
import type { DeletionStatus } from "@/types/deletion";

export interface RunDeletionParams {
  userId: string;
  email: string;
  integrations: Integration[];
  requestId: string;
  startedAt: string;
  /** Injected connector map (for tests). Defaults to the real registry. */
  connectors?: Record<string, ConnectorFn>;
  /** Injected credential loader (for tests). Defaults to Supabase + decrypt. */
  loadCredentials?: (
    userId: string,
    integration: Integration,
  ) => Promise<Record<string, string> | null>;
  /**
   * Set of integrations currently enabled by the owner (connector_flags).
   * Defense-in-depth: the API route already rejects disabled integrations, but
   * any that slip through here are skipped rather than run. When omitted,
   * availability is not checked (used by tests with injected connectors).
   */
  enabledSet?: Set<string>;
}

export interface OrchestratorResult {
  results: ConnectorResult[];
  status: DeletionStatus;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
}

async function defaultLoadCredentials(
  userId: string,
  integration: Integration,
): Promise<Record<string, string> | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("connector_credentials")
    .select("credentials")
    .eq("user_id", userId)
    .eq("integration", integration)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  try {
    return decryptJSON<Record<string, string>>(data.credentials);
  } catch {
    // 6.10/6.15 — A decryption failure is a real problem, not "no creds".
    // A compliance product must never confuse "we couldn't decrypt" with
    // "nothing was configured". Return a distinguishable error by throwing
    // so the caller sees a "failed" result rather than a silent "skipped".
    throw new Error(
      `Credential decryption failed for ${integration} — please reconnect credentials in the dashboard`,
    );
  }
}

function deriveStatus(results: ConnectorResult[]): DeletionStatus {
  if (results.length === 0) return "failed";
  const anySuccess = results.some((r) => r.status === "success");
  const anyFailed = results.some((r) => r.status === "failed");
  if (anyFailed && !anySuccess) return "failed";
  if (anyFailed && anySuccess) return "partial";
  return "completed";
}

/**
 * Run all requested connectors in parallel. Each connector runs inside its own
 * try/catch so one failure can't crash the others (Promise.allSettled). Audit
 * log writes are wrapped in their OWN inner try/catch — a logging hiccup must
 * never cause a connector result to vanish from the trail (Section 6.16).
 */
export async function runDeletion(
  params: RunDeletionParams,
): Promise<OrchestratorResult> {
  const registry = params.connectors ?? CONNECTORS;
  const load = params.loadCredentials ?? defaultLoadCredentials;
  const startedAt = params.startedAt;

  const tasks = params.integrations.map(async (integration): Promise<ConnectorResult> => {
    // Owner availability gate (defense in depth) — never run a disabled one.
    if (params.enabledSet && !params.enabledSet.has(integration)) {
      return {
        integration,
        status: "skipped",
        message: `Integration "${integration}" is currently disabled by the administrator`,
        durationMs: 0,
      };
    }

    const fn = registry[integration];
    if (!fn) {
      return {
        integration,
        status: "skipped",
        message: `Unknown or unregistered integration: ${integration}`,
        durationMs: 0,
      };
    }
    const creds = await load(params.userId, integration);
    if (!creds) {
      return {
        integration,
        status: "skipped",
        message: `No ${integration} credentials connected`,
        durationMs: 0,
      };
    }
    try {
      return await fn(params.email, creds);
    } catch (e) {
      return {
        integration,
        status: "failed",
        message: `${integration} connector threw`,
        error: (e as Error).message,
        durationMs: 0,
      };
    }
  });

  const settled = await Promise.allSettled(tasks);
  const results: ConnectorResult[] = settled.map((s) =>
    s.status === "fulfilled"
      ? s.value
      : {
          integration: "unknown" as Integration,
          status: "failed",
          message: "Connector task rejected",
          error: String(s.reason),
          durationMs: 0,
        },
  );

  // 6.16 — write audit rows, but NEVER let a logging failure drop results.
  try {
    await writeAuditLogs(params.requestId, results);
  } catch (logErr) {
    console.error("[orchestrator] audit log write failed (results preserved):", logErr);
  }

  const completedAt = new Date().toISOString();
  return {
    results,
    status: deriveStatus(results),
    startedAt,
    completedAt,
    elapsedMs: Date.now() - new Date(startedAt).getTime(),
  };
}
