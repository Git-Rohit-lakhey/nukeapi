import "server-only";
import type { ConnectorFn, SqlSpec } from "./types";
import type { ConnectorResult } from "@/types/connector";
import { failResult, okResult, skipResult } from "./util";

/**
 * SQL identifiers (table/column names) cannot be passed as bind parameters —
 * they must be interpolated into the statement. Per Section 6.14 they are
 * validated against a strict allowlist BEFORE use. Values (the email) are
 * always passed as parameters and never interpolated, so there is no
 * SQL-injection class of risk on the data side.
 */
export const POSTGRES_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

export function validateSqlIdentifier(name: string): boolean {
  return typeof name === "string" && POSTGRES_IDENTIFIER_RE.test(name);
}

/**
 * The universal SQL connector. v2 ships Postgres only (`pg` is the single
 * SQL driver dependency) — adding another database means adding its driver
 * to package.json AND a branch here, in a dedicated ROADMAP phase, not
 * silently. Parameterized by spec so Postgres-compatible targets stay config.
 */
export function sqlConnector(spec: SqlSpec): ConnectorFn {
  const key = spec.key;
  const label = spec.label;
  const placeholder = spec.placeholder ?? "$1";
  const itemNoun = spec.itemNoun ?? "row";

  return async function run(email: string, creds: Record<string, string>): Promise<ConnectorResult> {
    const start = Date.now();
    const table = creds[spec.tableField];
    const column = creds[spec.columnField];
    const conn = creds[spec.connectionStringField];

    if (!validateSqlIdentifier(table) || !validateSqlIdentifier(column)) {
      return failResult(
        key,
        "Invalid table or column identifier",
        start,
        `${spec.tableField} and ${spec.columnField} must match /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/`,
      );
    }

    if (spec.driver !== "pg") {
      return failResult(key, `Unsupported SQL driver: ${spec.driver}`, start, "v2 ships the pg driver only");
    }

    try {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: conn,
        ssl: { rejectUnauthorized: true },
        max: 1,
      });
      try {
        const client = await pool.connect();
        try {
          const { rowCount } = await client.query(
            `DELETE FROM "${table}" WHERE "${column}" = ${placeholder}`,
            [email],
          );
          if (!rowCount || rowCount === 0) {
            return skipResult(key, `No ${itemNoun}s in "${table}" matched that email`, start);
          }
          return okResult(key, `Deleted ${rowCount} ${itemNoun}${rowCount === 1 ? "" : "s"} from "${table}"`, start);
        } finally {
          client.release();
        }
      } finally {
        await pool.end();
      }
    } catch (e) {
      return failResult(key, `${label} deletion failed`, start, (e as Error).message);
    }
  };
}
