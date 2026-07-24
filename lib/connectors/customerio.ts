import { fetchWithRetry, parseJsonSafe } from "@/lib/connectors/fetchHelper";
import type { ConnectorResult, CustomerIOCredentials } from "@/types/connector";

const CUSTOMERIO_BASE = "https://api.customer.io";

export async function deleteCustomerIO(
  email: string,
  creds: CustomerIOCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  try {
    const auth = `Basic ${Buffer.from(
      `${creds.site_id}:${creds.api_key}`,
    ).toString("base64")}`;

    const searchRes = await fetchWithRetry(
      `${CUSTOMERIO_BASE}/v1/customers?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: { Authorization: auth },
      },
    );
    if (!searchRes.ok) {
      const b = await parseJsonSafe(searchRes);
      const msg = b?.message ?? `HTTP ${searchRes.status}`;
      return {
        integration: "customerio",
        status: "failed",
        message: "Customer.io lookup failed",
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const search = await parseJsonSafe(searchRes);
    const results: Array<{ id: string }> = search.results ?? [];
    if (results.length === 0) {
      return {
        integration: "customerio",
        status: "skipped",
        message: "No Customer.io customer matched that email",
        durationMs: Date.now() - start,
      };
    }

    let deleted = 0;
    for (const r of results) {
      const delRes = await fetchWithRetry(
        `${CUSTOMERIO_BASE}/v1/customers/${encodeURIComponent(r.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: auth },
        },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.message ?? `HTTP ${delRes.status}`;
        return {
          integration: "customerio",
          status: "failed",
          message: "Customer.io deletion failed",
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted++;
    }

    return {
      integration: "customerio",
      status: "success",
      message: `Deleted ${deleted} Customer.io customer(s) for ${email}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "customerio",
      status: "failed",
      message: "Customer.io deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
