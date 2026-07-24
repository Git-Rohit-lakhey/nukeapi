import type { ConnectorResult, MongoDBCredentials } from "@/types/connector";

/**
 * MongoDB connector. Real deletion via the official mongodb driver. The email
 * match is expressed as a BSON filter object — never string-interpolated — so
 * there is no SQL-injection class of risk here.
 */
export async function deleteMongo(
  email: string,
  creds: MongoDBCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  let client: import("mongodb").MongoClient | undefined;
  try {
    const { MongoClient } = await import("mongodb");
    client = new MongoClient(creds.connection_string);
    await client.connect();
    const db = client.db(creds.database);
    const res = await db
      .collection(creds.collection)
      .deleteMany({ [creds.email_field]: email });
    if (res.deletedCount === 0) {
      return {
        integration: "mongodb",
        status: "skipped",
        message: `No documents in ${creds.collection} matched that email`,
        durationMs: Date.now() - start,
      };
    }
    return {
      integration: "mongodb",
      status: "success",
      message: `Deleted ${res.deletedCount} document(s) from ${creds.collection}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "mongodb",
      status: "failed",
      message: "MongoDB deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  } finally {
    if (client) await client.close().catch(() => {});
  }
}
