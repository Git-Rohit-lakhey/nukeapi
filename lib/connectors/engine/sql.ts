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
 * The universal SQL connector. Parameterized by a spec so every SQL-backed
 * integration (Postgres, MySQL, PlanetScale, Neon, Turso) is pure config — no
 * per-database code file.
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

    try {
      if (spec.driver === "pg") {
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
      } else if (spec.driver === "mysql") {
        const mysql = await import("mysql2/promise");
        const pool = mysql.createPool({ uri: conn, connectionLimit: 1 });
        try {
          const [res] = (await pool.query(
            `DELETE FROM \`${table}\` WHERE \`${column}\` = ?`,
            [email],
          )) as any;
          const rowCount = Number(res?.affectedRows ?? 0);
          if (!rowCount || rowCount === 0) {
            return skipResult(key, `No ${itemNoun}s in \`${table}\` matched that email`, start);
          }
          return okResult(key, `Deleted ${rowCount} ${itemNoun}${rowCount === 1 ? "" : "s"} from \`${table}\``, start);
        } finally {
          await pool.end();
        }
      } else {
        const { createClient } = await import("@libsql/client");
        const client = createClient({
          url: conn,
          authToken: spec.authTokenField ? creds[spec.authTokenField] : undefined,
        });
        try {
          const res = await client.execute({
            sql: `DELETE FROM "${table}" WHERE "${column}" = ?`,
            args: [email],
          });
          const count = Number(res.rowsAffected ?? 0);
          if (count === 0) {
            return skipResult(key, `No ${itemNoun}s in "${table}" matched that email`, start);
          }
          return okResult(key, `Deleted ${count} ${itemNoun}${count === 1 ? "" : "s"} from "${table}"`, start);
        } finally {
          client.close();
        }
      }
    } catch (e) {
      return failResult(key, `${label} deletion failed`, start, (e as Error).message);
    }
  };
}
