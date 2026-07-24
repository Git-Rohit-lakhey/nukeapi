import type { ConnectorResult, SubstackCredentials } from "@/types/connector";

export async function deleteSubstack(
  email: string,
  _creds: SubstackCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  try {
    // Substack has no public erasure API. We never fake a deletion or make a
    // network call — the request is recorded as a clear, actionable skip so the
    // operator knows manual action is required.
    return {
      integration: "substack",
      status: "skipped",
      message:
        "Substack has no public erasure API; contact support to arrange deletion of this user's data.",
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "substack",
      status: "failed",
      message: "Substack deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
