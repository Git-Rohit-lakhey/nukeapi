import { validateSqlIdentifier } from "./postgresql";
import type { ConnectorResult, MysqlCredentials } from "@/types/connector";

/**
 * MySQL connector. Real DELETE via the mysql2 driver (Section 6.9 retry/timeout
 * does not apply to the DB driver itself, but the connection uses TLS). SQL
 * identifiers are validated before interpolation (6.14); the email value is
 * always parameterized.
 */
export async function deleteMysql(
  email: string,
  creds: MysqlCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  if (
    !validateSqlIdentifier(creds.table_name) ||
    !validateSqlIdentifier(creds.email_column)
  ) {
    return {
      integration: "mysql",
      status: "failed",
      message: "Invalid table or column identifier",
      error: "table_name and email_column must match /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/",
      durationMs: Date.now() - start,
    };
  }
  try {
    const mysql = await import("mysql2/promise");
    const pool = mysql.createPool({
      uri: creds.connection_string,
      connectionLimit: 1,
      multipleStatements: false,
      ssl: { rejectUnauthorized: true },
    });
    const [res] = await pool.query(
      `DELETE FROM \`${creds.table_name}\` WHERE \`${creds.email_column}\` = ?`,
      [email],
    );
    const affected = (res as { affectedRows?: number }).affectedRows ?? 0;
    await pool.end();
    if (!affected) {
      return {
        integration: "mysql",
        status: "skipped",
        message: `No rows in \`${creds.table_name}\` matched that email`,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "mysql",
      status: "success",
      message: `Deleted ${affected} row(s) from \`${creds.table_name}\``,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "mysql",
      status: "failed",
      message: "MySQL deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}
