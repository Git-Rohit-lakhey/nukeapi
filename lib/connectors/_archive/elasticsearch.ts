import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, ElasticsearchCredentials } from "@/types/connector";

/**
 * Elasticsearch connector. Real deletion via the _delete_by_query API.
 *
 * index_names is a comma-separated list (may contain spaces) — it is normalized
 * to a comma-joined string and used as the index path segment. The email is sent
 * as the `term` query value in the JSON body, never interpolated into the URL or
 * query string.
 */
export async function deleteElasticsearch(
  email: string,
  creds: ElasticsearchCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  try {
    const indexList = creds.index_names
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (indexList.length === 0) {
      return {
        integration: "elasticsearch",
        status: "failed",
        message: "No Elasticsearch index names provided",
        error: "index_names must be a non-empty comma-separated list",
        durationMs: Date.now() - start,
      };
    }
    // §6.14 — index names are interpolated into the URL path, so each must be a
    // clean identifier (no '/', no '..'). Reject anything that could break out.
    const ES_INDEX_RE = /^[a-z0-9_][a-z0-9_.-]*$/;
    for (const name of indexList) {
      if (!ES_INDEX_RE.test(name)) {
        return {
          integration: "elasticsearch",
          status: "failed",
          message: `Invalid Elasticsearch index name: ${name}`,
          error: "index names must match /^[a-z0-9_][a-z0-9_.-]*$/",
          durationMs: Date.now() - start,
        };
      }
    }
    const indices = indexList.join(",");

    const url = `${creds.endpoint.replace(/\/$/, "")}/${indices}/_delete_by_query`;
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        Authorization: "ApiKey " + creds.api_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { term: { email } } }),
    });

    if (!res.ok) {
      const body = await parseJsonSafe(res);
      return {
        integration: "elasticsearch",
        status: "failed",
        message: `Elasticsearch _delete_by_query failed with HTTP ${res.status}`,
        error: typeof body === "object" ? JSON.stringify(body) : String(body),
        durationMs: Date.now() - start,
      };
    }

    const json = await parseJsonSafe(res);
    const deleted = json.deleted ?? json.total ?? 0;

    if (deleted === 0) {
      return {
        integration: "elasticsearch",
        status: "skipped",
        message: `No documents matched email in indexes`,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "elasticsearch",
      status: "success",
      message: `Deleted ${deleted} document(s) from ${indices}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "elasticsearch",
      status: "failed",
      message: "Elasticsearch deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
