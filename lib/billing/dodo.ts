import "server-only";
import { fetchWithRetry, parseJsonSafe, ConnectorHttpError } from "@/lib/connectors/fetchHelper";
import { dodoProductEnvFor, type PlanSlug } from "@/lib/constants/compliance";

/**
 * Dodo Payments client. NOTE the base URL (Section 2): test mode is
 * https://test.dodopayments.com and live mode is https://live.dodopayments.com.
 * api.dodopayments.com is NOT a real Dodo host.
 */
export function getDodoBaseUrl(): string {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

function dodoAuthHeaders(): Record<string, string> {
  const key = process.env.DODO_PAYMENTS_API_KEY;
  if (!key) throw new Error("DODO_PAYMENTS_API_KEY is not configured");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export interface CheckoutParams {
  userId: string;
  email: string;
  plan: PlanSlug;
  returnUrl?: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  checkoutId: string;
}

export async function createCheckoutSession(
  params: CheckoutParams,
): Promise<CheckoutResult> {
  const productEnv = dodoProductEnvFor(params.plan);
  if (!productEnv) {
    throw new Error(`No Dodo product configured for plan: ${params.plan}`);
  }
  const productId = process.env[productEnv];
  if (!productId) {
    throw new Error(`Missing env ${productEnv} for plan ${params.plan}`);
  }

  const url = `${getDodoBaseUrl()}/checkouts`;
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: dodoAuthHeaders(),
    body: JSON.stringify({
      product_cart: [{ product_id: productId }],
      customer: { email: params.email },
      return_url: params.returnUrl ?? process.env.DODO_PAYMENTS_RETURN_URL,
      metadata: { user_id: params.userId },
      redirect: true,
    }),
  });

  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new ConnectorHttpError(
      `Dodo checkout failed: ${body?.message ?? res.status}`,
      res.status,
    );
  }
  const json = await parseJsonSafe(res);
  const checkoutUrl = json.checkout_url ?? json.url;
  if (!checkoutUrl) {
    throw new Error("Dodo checkout response missing checkout_url");
  }
  return { checkoutUrl, checkoutId: json.id ?? json.checkout_id ?? "" };
}

/**
 * Cancel a subscription via the payment provider (Section 6.12). We ONLY mark
 * the local row cancelled after this succeeds — never the other way around.
 */
export async function cancelSubscription(
  externalSubscriptionId: string,
): Promise<{ cancelled: boolean }> {
  const url = `${getDodoBaseUrl()}/subscriptions/${externalSubscriptionId}`;
  const res = await fetchWithRetry(url, {
    method: "PATCH",
    headers: dodoAuthHeaders(),
    body: JSON.stringify({ cancel_at_next_billing_date: true }),
  });

  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new ConnectorHttpError(
      `Dodo cancel failed: ${body?.message ?? res.status}`,
      res.status,
    );
  }
  return { cancelled: true };
}
