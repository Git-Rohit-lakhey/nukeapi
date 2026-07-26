import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, FirebaseAuthCredentials } from "@/types/connector";

/**
 * Firebase Auth connector. Look up the user by email via the Identity Toolkit
 * Admin API (Bearer OAuth2 access token), then delete each match by localId.
 */
export async function deleteFirebaseAuth(
  email: string,
  creds: FirebaseAuthCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = `https://identitytoolkit.googleapis.com/v1/projects/${creds.project_id}`;
  const headers = {
    Authorization: `Bearer ${creds.access_token}`,
    "Content-Type": "application/json",
  };
  try {
    const lookup = await fetchWithRetry(`${base}/accounts:lookup`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: [email] }),
    });
    if (!lookup.ok) {
      const b = await parseJsonSafe(lookup);
      return {
        integration: "firebaseauth",
        status: "failed",
        message: `Firebase Auth lookup returned ${lookup.status}`,
        error: b?.error?.message ?? `HTTP ${lookup.status}`,
        durationMs: Date.now() - start,
      };
    }
    const json = await parseJsonSafe(lookup);
    const users: Array<{ localId: string }> = json.users ?? [];
    if (users.length === 0) {
      return {
        integration: "firebaseauth",
        status: "skipped",
        message: "No Firebase Auth user matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const u of users) {
      const d = await fetchWithRetry(`${base}/accounts:delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ localId: u.localId }),
      });
      if (d.ok) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "firebaseauth",
        status: "failed",
        message: "Failed to delete any Firebase Auth user",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "firebaseauth",
      status: "success",
      message: `Deleted ${deleted} Firebase Auth user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "firebaseauth",
      status: "failed",
      message: "Firebase Auth deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
