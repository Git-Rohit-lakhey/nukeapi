import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, StripeCredentials } from "@/types/connector";

const STRIPE_BASE = "https://api.stripe.com";

export async function deleteStripe(
  email: string,
  creds: StripeCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const auth = "Basic " + Buffer.from(`${creds.secret_key}:`).toString("base64");
  const headers = { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" };

  try {
    let deleted = 0;
    let startingAfter: string | undefined;

    do {
      const url =
        `${STRIPE_BASE}/v1/customers?email=${encodeURIComponent(email)}` +
        `&limit=100${startingAfter ? `&starting_after=${startingAfter}` : ""}`;
      const res = await fetchWithRetry(url, { method: "GET", headers });

      // 6.10 — check response.ok BEFORE reading the body (an auth error has a
      // differently-shaped body; reading `.data` off it yields undefined, which
      // must not be silently treated as "nothing to delete").
      if (!res.ok) {
        const body = await parseJsonSafe(res);
        return {
          integration: "stripe",
          status: "failed",
          message: `Stripe API returned ${res.status}`,
          error: body?.error?.message ?? `HTTP ${res.status}`,
          durationMs: Date.now() - start,
        };
      }

      const json = await parseJsonSafe(res);
      const customers: Array<{ id: string }> = json.data ?? [];

      // 6.11 — paginate through ALL matches, not just the first page.
      for (const c of customers) {
        const delRes = await fetchWithRetry(
          `${STRIPE_BASE}/v1/customers/${c.id}`,
          { method: "DELETE", headers },
        );
        if (!delRes.ok) {
          const b = await parseJsonSafe(delRes);
          return {
            integration: "stripe",
            status: "failed",
            message: `Failed to delete Stripe customer ${c.id}`,
            error: b?.error?.message ?? `HTTP ${delRes.status}`,
            durationMs: Date.now() - start,
          };
        }
        deleted++;
      }

      startingAfter = customers.length === 100 ? customers[customers.length - 1].id : undefined;
    } while (startingAfter);

    if (deleted === 0) {
      return {
        integration: "stripe",
        status: "skipped",
        message: "No Stripe customers matched that email",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "stripe",
      status: "success",
      message: `Deleted ${deleted} Stripe customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "stripe",
      status: "failed",
      message: "Stripe deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
