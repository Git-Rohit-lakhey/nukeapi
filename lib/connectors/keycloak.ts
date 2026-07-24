import { fetchWithRetry, parseJsonSafe } from "./fetchHelper";
import type { ConnectorResult, KeycloakCredentials } from "@/types/connector";

export async function deleteKeycloak(
  email: string,
  creds: KeycloakCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  const base = creds.base_url.replace(/\/$/, "");

  try {
    // Step 1 — obtain an admin access token using the master realm.
    const tokenRes = await fetchWithRetry(
      `${base}/realms/master/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "password",
          client_id: "admin-cli",
          username: creds.admin_username,
          password: creds.admin_password,
        }).toString(),
      },
    );
    if (!tokenRes.ok) {
      const b = await parseJsonSafe(tokenRes);
      const msg = b?.error_description ?? b?.error ?? `HTTP ${tokenRes.status}`;
      return {
        integration: "keycloak",
        status: "failed",
        message: `Keycloak token request returned ${tokenRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }
    const token = await parseJsonSafe(tokenRes);
    const accessToken: string | undefined = token.access_token;
    if (!accessToken) {
      return {
        integration: "keycloak",
        status: "failed",
        message: "Keycloak token request returned no access_token",
        error: "missing access_token in response",
        durationMs: Date.now() - start,
      };
    }

    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    // Step 2 — find users in the target realm matching the email.
    const listRes = await fetchWithRetry(
      `${base}/admin/realms/${encodeURIComponent(creds.realm)}/users?email=${encodeURIComponent(email)}`,
      { method: "GET", headers: authHeaders },
    );
    if (!listRes.ok) {
      const b = await parseJsonSafe(listRes);
      const msg = b?.errorMessage ?? b?.error ?? `HTTP ${listRes.status}`;
      return {
        integration: "keycloak",
        status: "failed",
        message: `Keycloak user lookup returned ${listRes.status}`,
        error: msg,
        durationMs: Date.now() - start,
      };
    }

    const users: Array<{ id: string }> = await parseJsonSafe(listRes);
    if (!Array.isArray(users) || users.length === 0) {
      return {
        integration: "keycloak",
        status: "skipped",
        message: "No Keycloak user matched that email",
        durationMs: Date.now() - start,
      };
    }

    // Step 3 — delete every matching user.
    let deleted = 0;
    for (const u of users) {
      const delRes = await fetchWithRetry(
        `${base}/admin/realms/${encodeURIComponent(creds.realm)}/users/${encodeURIComponent(u.id)}`,
        { method: "DELETE", headers: authHeaders },
      );
      if (!delRes.ok) {
        const b = await parseJsonSafe(delRes);
        const msg = b?.errorMessage ?? b?.error ?? `HTTP ${delRes.status}`;
        return {
          integration: "keycloak",
          status: "failed",
          message: `Keycloak deletion failed for user ${u.id}`,
          error: msg,
          durationMs: Date.now() - start,
        };
      }
      deleted += 1;
    }

    return {
      integration: "keycloak",
      status: "success",
      message: `Deleted ${deleted} Keycloak user(s)`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "keycloak",
      status: "failed",
      message: "Keycloak deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
