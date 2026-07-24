import { validateSqlIdentifier } from "./postgresql";
import type { ConnectorResult, NeonCredentials } from "@/types/connector";

/**
 * Neon connector. Neon is serverless Postgres, so we reuse the pg driver with
 * the provided connection string. Identifiers validated before interpolation
 * (6.14); email is parameterized.
 */
export async function deleteNeon(
  email: string,
  creds: NeonCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  if (
    !validateSqlIdentifier(creds.table_name) ||
    !validateSqlIdentifier(creds.email_column)
  ) {
    return {
      integration: "neon",
      status: "failed",
      message: "Invalid table or column identifier",
      error: "table_name and email_column must match /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/",
      durationMs: Date.now() - start,
    };
  }
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: creds.connection_string,
      ssl: { rejectUnauthorized: true },
      max: 1,
    });
    const { rowCount } = await pool.query(
      `DELETE FROM "${creds.table_name}" WHERE "${creds.email_column}" = $1`,
      [email],
    );
    await pool.end();
    if (!rowCount || rowCount === 0) {
      return {
        integration: "neon",
        status: "skipped",
        message: `No rows in "${creds.table_name}" matched that email`,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "neon",
      status: "success",
      message: `Deleted ${rowCount} row(s) from "${creds.table_name}"`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "neon",
      status: "failed",
      message: "Neon deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
