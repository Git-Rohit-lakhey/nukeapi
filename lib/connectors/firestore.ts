import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, FirestoreCredentials } from "@/types/connector";

/**
 * Firestore connector. Google Firestore has no delete-by-query REST endpoint,
 * so we run a structured query (filter by the email field) and DELETE each
 * matching document by its full resource name. Uses the REST API with an
 * OAuth2 access token — no extra SDK dependency. The email value is sent as a
 * typed stringValue in the structured query, never interpolated into a string.
 */
export async function deleteFirestore(
  email: string,
  creds: FirestoreCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = `https://firestore.googleapis.com/v1/projects/${creds.project_id}/databases/(default)/documents`;
  const headers = {
    Authorization: `Bearer ${creds.access_token}`,
    "Content-Type": "application/json",
  };
  try {
    const qRes = await fetchWithRetry(
      `${base}:runQuery`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: creds.collection }],
            where: {
              fieldFilter: {
                field: { fieldPath: creds.email_field },
                op: "EQUAL",
                value: { stringValue: email },
              },
            },
          },
        }),
      },
    );
    if (!qRes.ok) {
      const b = await parseJsonSafe(qRes);
      return {
        integration: "firestore",
        status: "failed",
        message: `Firestore query returned ${qRes.status}`,
        error: b?.error?.message ?? `HTTP ${qRes.status}`,
        durationMs: Date.now() - start,
      };
    }
    const arr = (await qRes.json()) as Array<{ document?: { name: string } }>;
    const names = arr.map((x) => x.document?.name).filter(Boolean) as string[];
    if (names.length === 0) {
      return {
        integration: "firestore",
        status: "skipped",
        message: `No Firestore documents in ${creds.collection} matched that email`,
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const name of names) {
      const d = await fetchWithRetry(name, { method: "DELETE", headers });
      // 200/204 = deleted; 404 = already gone (count as deleted).
      if (d.status < 300 || d.status === 404) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "firestore",
        status: "failed",
        message: "Failed to delete any matching Firestore document",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "firestore",
      status: "success",
      message: `Deleted ${deleted} Firestore document(s) from ${creds.collection}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "firestore",
      status: "failed",
      message: "Firestore deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
