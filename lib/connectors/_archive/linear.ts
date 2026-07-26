import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, LinearCredentials } from "@/types/connector";

const LINEAR_GQL = "https://api.linear.app/graphql";

export async function deleteLinear(
  email: string,
  creds: LinearCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const headers = {
    Authorization: `Bearer ${creds.api_key}`,
    "Content-Type": "application/json",
  };
  const safeEmail = email.replace(/"/g, '\\"');

  try {
    // Find users matching the email.
    const findRes = await fetchWithRetry(LINEAR_GQL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `query { users(filter: { email: { eq: "${safeEmail}" } }) { nodes { id } } }`,
      }),
    });
    if (!findRes.ok) {
      const b = await parseJsonSafe(findRes);
      const msg = b?.errors?.[0]?.message ?? `HTTP ${findRes.status}`;
      return {
        integration: "linear",
        status: "failed",
        message: `Linear search returned ${findRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const found = await parseJsonSafe(findRes);
    const nodes: Array<{ id: string }> = found?.data?.users?.nodes ?? [];
    if (nodes.length === 0) {
      return {
        integration: "linear",
        status: "skipped",
        message: "No Linear users matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const node of nodes) {
      const delRes = await fetchWithRetry(LINEAR_GQL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: `mutation { userDelete(id: "${node.id}") { success } }`,
        }),
      });
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.errors?.[0]?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "linear",
          status: "failed",
          message: `Linear deletion failed for ${node.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      const d = await parseJsonSafe(delRes);
      if (d?.data?.userDelete?.success) deleted++;
    }

    if (deleted === 0) {
      return {
        integration: "linear",
        status: "failed",
        message: "Linear users found but deletion did not succeed",
        durationMs: Date.now() - start,
      };
    }

    return {
      integration: "linear",
      status: "success",
      message: `Deleted ${deleted} Linear user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "linear",
      status: "failed",
      message: "Linear deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
