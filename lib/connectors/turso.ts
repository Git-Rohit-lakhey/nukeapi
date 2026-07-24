import type { ConnectorResult, TursoCredentials } from "@/types/connector";
import { validateSqlIdentifier } from "@/lib/connectors/postgresql";

/**
 * Turso (libSQL) connector. Real deletion via the @libsql/client driver.
 *
 * SQL identifiers (table/column names) cannot be passed as query parameters —
 * they must be interpolated into the statement, so they are validated against a
 * strict allowlist before use (Section 6.14). The email IS a bound parameter and
 * is never interpolated.
 */
export async function deleteTurso(
  email: string,
  creds: TursoCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();

  // 6.14 — reject any identifier that isn't a clean SQL name.
  if (!validateSqlIdentifier(creds.table_name) || !validateSqlIdentifier(creds.email_column)) {
    return {
      integration: "turso",
      status: "failed",
      message: "Invalid table or column name",
      error: "table_name and email_column must match /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/",
      durationMs: Date.now() - start,
    };
  }

  let client: import("@libsql/client").Client | undefined;
  try {
    const { createClient } = await import("@libsql/client");
    client = createClient({ url: creds.database_url, authToken: creds.auth_token });
    const res = await client.execute({
      sql: `DELETE FROM "${creds.table_name}" WHERE "${creds.email_column}" = ?`,
      args: [email],
    });
    const rowsAffected = (res as any).rowsAffected ?? 0;

    if (rowsAffected === 0) {
      return {
        integration: "turso",
        status: "skipped",
        message: `No rows in ${creds.table_name} matched that email`,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "turso",
      status: "success",
      message: `Deleted ${rowsAffected} row(s) from ${creds.table_name}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "turso",
      status: "failed",
      message: "Turso deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {
        /* ignore close errors */
      }
    }
  }
}
