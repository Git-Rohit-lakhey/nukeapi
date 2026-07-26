import type { ConnectorResult, CassandraCredentials } from "@/types/connector";
import { validateSqlIdentifier } from "@/lib/connectors/postgresql";

/**
 * Apache Cassandra connector. Real deletion via the cassandra-driver.
 *
 * SQL-style identifiers (table/column names) cannot be passed as query
 * parameters — they must be interpolated into the CQL statement, so they are
 * validated against a strict allowlist before use (Section 6.14). The email IS a
 * bound value (`prepare: true`) and is never interpolated.
 *
 * localDataCenter: "datacenter1" is the assumed default DC — Cassandra requires
 * a local data center name to be set. Override via contact-points/DSE snitch in
 * production if your cluster uses a different DC name.
 */
export async function deleteCassandra(
  email: string,
  creds: CassandraCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();

  // 6.14 — reject any identifier that isn't a clean CQL name.
  if (!validateSqlIdentifier(creds.table_name) || !validateSqlIdentifier(creds.email_column)) {
    return {
      integration: "cassandra",
      status: "failed",
      message: "Invalid table or column name",
      error: "table_name and email_column must match /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/",
      durationMs: Date.now() - start,
    };
  }

  let client: import("cassandra-driver").Client | undefined;
  try {
    const { Client } = await import("cassandra-driver");
    client = new Client({
      contactPoints: creds.contact_points
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      keyspace: creds.keyspace,
      credentials: { username: creds.username, password: creds.password },
      localDataCenter: "datacenter1", // assumed default DC — override if your cluster differs
    });
    await client.connect();

    const cnt = await client.execute(
      `SELECT count(*) AS c FROM "${creds.table_name}" WHERE "${creds.email_column}" = ?`,
      [email],
      { prepare: true },
    );
    const n = Number((cnt.rows[0] as any).c ?? 0);

    if (n === 0) {
      return {
        integration: "cassandra",
        status: "skipped",
        message: `No rows in ${creds.table_name} matched that email`,
        durationMs: Date.now() - start,
      };
    }

    await client.execute(
      `DELETE FROM "${creds.table_name}" WHERE "${creds.email_column}" = ?`,
      [email],
      { prepare: true },
    );
    return {
      integration: "cassandra",
      status: "success",
      message: `Deleted ${n} row(s) from ${creds.table_name}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "cassandra",
      status: "failed",
      message: "Cassandra deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  } finally {
    if (client) await client.shutdown().catch(() => {});
  }
}
