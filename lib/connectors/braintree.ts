import type { ConnectorResult, BraintreeCredentials } from "@/types/connector";

/**
 * Braintree connector. Braintree's merchant REST surface has no clean
 * delete-by-email, so we use the official Braintree SDK: search customers by
 * email, then delete each match. Real deletes, no HTML scraping.
 */
export async function deleteBraintree(
  email: string,
  creds: BraintreeCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  try {
    const braintree = await import("braintree");
    const gateway = new braintree.BraintreeGateway({
      merchantId: creds.merchant_id,
      publicKey: creds.api_key,
      privateKey: creds.private_key,
    });
    const search = await gateway.customer.search((s: any) => {
      s.email().is(email);
    });
    const ids: string[] = [];
    search.each((c: { id: string }) => ids.push(c.id));
    if (ids.length === 0) {
      return {
        integration: "braintree",
        status: "skipped",
        message: "No Braintree customer matched that email",
        durationMs: Date.now() - start,
      };
    }
    let deleted = 0;
    for (const id of ids) {
      const r = await gateway.customer.delete(id);
      if (r.success) deleted++;
    }
    if (deleted === 0) {
      return {
        integration: "braintree",
        status: "failed",
        message: "Failed to delete any Braintree customer",
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "braintree",
      status: "success",
      message: `Deleted ${deleted} Braintree customer(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "braintree",
      status: "failed",
      message: "Braintree deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
