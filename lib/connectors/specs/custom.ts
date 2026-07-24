import "server-only";
import type { ConnectorSpec } from "../engine/types";
import { fetchWithRetry, parseJsonSafe } from "../fetchHelper";
import { validateSqlIdentifier } from "../engine/sql";

/**
 * Universal connector engine — driver-based (non-HTTP) CustomSpec closures.
 *
 * Each `run` below is the EXACT logic of the original
 * `lib/connectors/<name>.ts` connector function, relocated verbatim into a
 * `CustomSpec` so the universal engine can dispatch it uniformly. Behavior,
 * endpoints, status handling, count logic, and messages are preserved exactly —
 * only the typed credential interface was replaced with string-indexed
 * `creds.fieldName` access and the dynamic SDK imports were kept inside `run`.
 */

// ── MongoDB ────────────────────────────────────────────────────────────────
export const CUSTOM_SPECS: ConnectorSpec[] = [
  {
    key: "mongodb",
    transport: "custom",
    label: "MongoDB",
    run: async (email: string, creds: Record<string, string>) => {
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
    },
  },

  // ── Firestore ──────────────────────────────────────────────────────────────
  {
    key: "firestore",
    transport: "custom",
    label: "Firestore",
    run: async (email: string, creds: Record<string, string>) => {
      const start = Date.now();
      const base = `https://firestore.googleapis.com/v1/projects/${creds.project_id}/databases/(default)/documents`;
      const headers = {
        Authorization: `Bearer ${creds.access_token}`,
        "Content-Type": "application/json",
      };
      try {
        const qRes = await fetchWithRetry(
          `${base}:runQuery`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              structuredQuery: {
                from: [{ collectionId: creds.collection }],
                where: {
                  fieldFilter: {
                    field: { fieldPath: creds.email_field },
                    op: "EQUAL",
                    value: { stringValue: email },
                  },
                },
              },
            }),
          },
        );
        if (!qRes.ok) {
          const b = await parseJsonSafe(qRes);
          return {
            integration: "firestore",
            status: "failed",
            message: `Firestore query returned ${qRes.status}`,
            error: b?.error?.message ?? `HTTP ${qRes.status}`,
            durationMs: Date.now() - start,
          };
        }
        const arr = (await qRes.json()) as Array<{ document?: { name: string } }>;
        const names = arr.map((x) => x.document?.name).filter(Boolean) as string[];
        if (names.length === 0) {
          return {
            integration: "firestore",
            status: "skipped",
            message: `No Firestore documents in ${creds.collection} matched that email`,
            durationMs: Date.now() - start,
          };
        }
        let deleted = 0;
        for (const name of names) {
          const d = await fetchWithRetry(name, { method: "DELETE", headers });
          // 200/204 = deleted; 404 = already gone (count as deleted).
          if (d.status < 300 || d.status === 404) deleted++;
        }
        if (deleted === 0) {
          return {
            integration: "firestore",
            status: "failed",
            message: "Failed to delete any matching Firestore document",
            durationMs: Date.now() - start,
          };
        }
        return {
          integration: "firestore",
          status: "success",
          message: `Deleted ${deleted} Firestore document(s) from ${creds.collection}`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "firestore",
          status: "failed",
          message: "Firestore deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      }
    },
  },

  // ── Upstash Redis ─────────────────────────────────────────────────────────
  {
    key: "redis",
    transport: "custom",
    label: "Upstash Redis",
    run: async (email: string, creds: Record<string, string>) => {
      const start = Date.now();
      try {
        const { Redis } = await import("@upstash/redis");
        const redis = new Redis({ url: creds.rest_url, token: creds.rest_token });

        // SCAN loop instead of KEYS to avoid blocking the server on large datasets.
        let cursor = "0";
        const keys: string[] = [];
        do {
          const [next, found] = await redis.scan(cursor, {
            match: creds.key_pattern,
            count: 200,
          });
          cursor = next;
          keys.push(...found);
        } while (cursor !== "0");

        if (keys.length === 0) {
          return {
            integration: "redis",
            status: "skipped",
            message: `No keys matched pattern ${creds.key_pattern}`,
            durationMs: Date.now() - start,
          };
        }

        await redis.del(...keys);
        return {
          integration: "redis",
          status: "success",
          message: `Deleted ${keys.length} key(s) matching ${creds.key_pattern}`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "redis",
          status: "failed",
          message: "Redis deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      }
    },
  },

  // ── Cassandra ──────────────────────────────────────────────────────────────
  {
    key: "cassandra",
    transport: "custom",
    label: "Cassandra",
    run: async (email: string, creds: Record<string, string>) => {
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
    },
  },

  // ── AWS S3 ───────────────────────────────────────────────────────────────
  {
    key: "awss3",
    transport: "custom",
    label: "AWS S3",
    run: async (email: string, creds: Record<string, string>) => {
      const start = Date.now();
      let client: import("@aws-sdk/client-s3").S3Client | undefined;

      try {
        const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } =
          await import("@aws-sdk/client-s3");

        client = new S3Client({
          region: creds.region,
          credentials: {
            accessKeyId: creds.access_key,
            secretAccessKey: creds.secret_key,
          },
        });

        // If the pattern contains a wildcard, list under the prefix before the
        // "*" and filter client-side; otherwise list the literal prefix.
        const hasWildcard = creds.prefix_pattern.includes("*");
        const listPrefix = hasWildcard
          ? creds.prefix_pattern.split("*")[0]
          : creds.prefix_pattern;

        const keys: string[] = [];
        let continuationToken: string | undefined;
        do {
          const listRes = await client.send(
            new ListObjectsV2Command({
              Bucket: creds.bucket,
              Prefix: listPrefix,
              ContinuationToken: continuationToken,
            }),
          );
          const contents = listRes.Contents ?? [];
          for (const o of contents) {
            if (o.Key && (!hasWildcard || wildcardMatch(o.Key, creds.prefix_pattern))) {
              keys.push(o.Key);
            }
          }
          continuationToken = listRes.IsTruncated
            ? listRes.NextContinuationToken
            : undefined;
        } while (continuationToken);

        if (keys.length === 0) {
          return {
            integration: "awss3",
            status: "skipped",
            message: `No objects matched ${creds.prefix_pattern} in ${creds.bucket}`,
            durationMs: Date.now() - start,
          };
        }

        // Delete in batches of 1000 (S3 DeleteObjects limit).
        for (let i = 0; i < keys.length; i += 1000) {
          const chunk = keys.slice(i, i + 1000);
          await client.send(
            new DeleteObjectsCommand({
              Bucket: creds.bucket,
              Delete: { Objects: chunk.map((Key) => ({ Key })) },
            }),
          );
        }

        return {
          integration: "awss3",
          status: "success",
          message: `Deleted ${keys.length} object(s) under ${creds.prefix_pattern}`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "awss3",
          status: "failed",
          message: "AWS S3 deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      } finally {
        if (client) {
          try {
            await client.destroy();
          } catch {
            /* ignore teardown errors */
          }
        }
      }
    },
  },

  // ── Cloudflare R2 ─────────────────────────────────────────────────────────
  {
    key: "cloudflarer2",
    transport: "custom",
    label: "Cloudflare R2",
    run: async (email: string, creds: Record<string, string>) => {
      const start = Date.now();
      let client: import("@aws-sdk/client-s3").S3Client | undefined;

      try {
        const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } =
          await import("@aws-sdk/client-s3");

        client = new S3Client({
          region: "auto",
          endpoint: `https://${creds.account_id}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: creds.access_key,
            secretAccessKey: creds.secret_key,
          },
        });

        const hasWildcard = creds.prefix_pattern.includes("*");
        const listPrefix = hasWildcard
          ? creds.prefix_pattern.split("*")[0]
          : creds.prefix_pattern;

        const keys: string[] = [];
        let continuationToken: string | undefined;
        do {
          const listRes = await client.send(
            new ListObjectsV2Command({
              Bucket: creds.bucket,
              Prefix: listPrefix,
              ContinuationToken: continuationToken,
            }),
          );
          const contents = listRes.Contents ?? [];
          for (const o of contents) {
            if (o.Key && (!hasWildcard || wildcardMatch(o.Key, creds.prefix_pattern))) {
              keys.push(o.Key);
            }
          }
          continuationToken = listRes.IsTruncated
            ? listRes.NextContinuationToken
            : undefined;
        } while (continuationToken);

        if (keys.length === 0) {
          return {
            integration: "cloudflarer2",
            status: "skipped",
            message: `No objects matched ${creds.prefix_pattern} in ${creds.bucket}`,
            durationMs: Date.now() - start,
          };
        }

        for (let i = 0; i < keys.length; i += 1000) {
          const chunk = keys.slice(i, i + 1000);
          await client.send(
            new DeleteObjectsCommand({
              Bucket: creds.bucket,
              Delete: { Objects: chunk.map((Key) => ({ Key })) },
            }),
          );
        }

        return {
          integration: "cloudflarer2",
          status: "success",
          message: `Deleted ${keys.length} object(s) under ${creds.prefix_pattern}`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "cloudflarer2",
          status: "failed",
          message: "Cloudflare R2 deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      } finally {
        if (client) {
          try {
            await client.destroy();
          } catch {
            /* ignore teardown errors */
          }
        }
      }
    },
  },

  // ── Google Cloud Storage ──────────────────────────────────────────────────
  {
    key: "googlecloudstorage",
    transport: "custom",
    label: "Google Cloud Storage",
    run: async (email: string, creds: Record<string, string>) => {
      const start = Date.now();
      let storage: import("@google-cloud/storage").Storage | undefined;

      try {
        const { Storage } = await import("@google-cloud/storage");
        storage = new Storage({ credentials: JSON.parse(creds.service_account_json) });
        const bucket = storage.bucket(creds.bucket);

        const [files] = await bucket.getFiles({ prefix: creds.prefix_pattern });

        if (files.length === 0) {
          return {
            integration: "googlecloudstorage",
            status: "skipped",
            message: `No objects matched ${creds.prefix_pattern} in ${creds.bucket}`,
            durationMs: Date.now() - start,
          };
        }

        // deleteFiles honors the same prefix and paginates internally.
        await bucket.deleteFiles({ prefix: creds.prefix_pattern });

        return {
          integration: "googlecloudstorage",
          status: "success",
          message: `Deleted ${files.length} object(s) under ${creds.prefix_pattern}`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "googlecloudstorage",
          status: "failed",
          message: "Google Cloud Storage deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      } finally {
        // @google-cloud/storage manages its own client lifecycle; no explicit
        // close() is exposed on the Storage type, so nothing to tear down.
      }
    },
  },

  // ── Vercel Blob ───────────────────────────────────────────────────────────
  {
    key: "vercelblob",
    transport: "custom",
    label: "Vercel Blob",
    run: async (email: string, creds: Record<string, string>) => {
      const start = Date.now();

      try {
        const { list, del } = await import("@vercel/blob");

        const urls: string[] = [];
        let cursor: string | undefined;
        do {
          const res = await list({
            token: creds.api_token,
            prefix: creds.prefix_pattern,
            cursor,
          });
          for (const b of res.blobs) {
            if (b.url) urls.push(b.url);
          }
          cursor = res.hasMore ? res.cursor : undefined;
        } while (cursor);

        if (urls.length === 0) {
          return {
            integration: "vercelblob",
            status: "skipped",
            message: `No blobs matched ${creds.prefix_pattern}`,
            durationMs: Date.now() - start,
          };
        }

        for (const url of urls) {
          await del(url, { token: creds.api_token });
        }

        return {
          integration: "vercelblob",
          status: "success",
          message: `Deleted ${urls.length} blob(s) under ${creds.prefix_pattern}`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "vercelblob",
          status: "failed",
          message: "Vercel Blob deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      }
    },
  },

  // ── AWS Cognito ───────────────────────────────────────────────────────────
  {
    key: "cognito",
    transport: "custom",
    label: "AWS Cognito",
    run: async (email: string, creds: Record<string, string>) => {
      const start = Date.now();

      try {
        // AWS SDK is dynamically imported so it never ends up in a client bundle
        // and only loads when this connector actually runs.
        const {
          CognitoIdentityProviderClient,
          AdminGetUserCommand,
          AdminDeleteUserCommand,
        } = await import("@aws-sdk/client-cognito-identity-provider");

        const client = new CognitoIdentityProviderClient({
          region: creds.region,
          credentials: {
            accessKeyId: creds.access_key,
            secretAccessKey: creds.secret_key,
          },
        });

        // Look the user up first so we can distinguish "not found" (skipped)
        // from a genuine failure (failed). Cognito uses the email as Username.
        try {
          await client.send(
            new AdminGetUserCommand({
              UserPoolId: creds.user_pool_id,
              Username: email,
            }),
          );
        } catch (getErr) {
          const name = (getErr as { name?: string })?.name;
          if (name === "UserNotFoundException") {
            return {
              integration: "cognito",
              status: "skipped",
              message: "No Cognito user matched that email",
              durationMs: Date.now() - start,
            };
          }
          // Any other lookup error (auth, permissions, network) is a real failure.
          throw getErr;
        }

        await client.send(
          new AdminDeleteUserCommand({
            UserPoolId: creds.user_pool_id,
            Username: email,
          }),
        );

        return {
          integration: "cognito",
          status: "success",
          message: `Deleted user ${email} from Cognito user pool`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "cognito",
          status: "failed",
          message: "Cognito deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      }
    },
  },

  // ── Firebase Auth ─────────────────────────────────────────────────────────
  {
    key: "firebaseauth",
    transport: "custom",
    label: "Firebase Auth",
    run: async (email: string, creds: Record<string, string>) => {
      const start = Date.now();
      const base = `https://identitytoolkit.googleapis.com/v1/projects/${creds.project_id}`;
      const headers = {
        Authorization: `Bearer ${creds.access_token}`,
        "Content-Type": "application/json",
      };
      try {
        const lookup = await fetchWithRetry(`${base}/accounts:lookup`, {
          method: "POST",
          headers,
          body: JSON.stringify({ email: [email] }),
        });
        if (!lookup.ok) {
          const b = await parseJsonSafe(lookup);
          return {
            integration: "firebaseauth",
            status: "failed",
            message: `Firebase Auth lookup returned ${lookup.status}`,
            error: b?.error?.message ?? `HTTP ${lookup.status}`,
            durationMs: Date.now() - start,
          };
        }
        const json = await parseJsonSafe(lookup);
        const users: Array<{ localId: string }> = json.users ?? [];
        if (users.length === 0) {
          return {
            integration: "firebaseauth",
            status: "skipped",
            message: "No Firebase Auth user matched that email",
            durationMs: Date.now() - start,
          };
        }
        let deleted = 0;
        for (const u of users) {
          const d = await fetchWithRetry(`${base}/accounts:delete`, {
            method: "POST",
            headers,
            body: JSON.stringify({ localId: u.localId }),
          });
          if (d.ok) deleted++;
        }
        if (deleted === 0) {
          return {
            integration: "firebaseauth",
            status: "failed",
            message: "Failed to delete any Firebase Auth user",
            durationMs: Date.now() - start,
          };
        }
        return {
          integration: "firebaseauth",
          status: "success",
          message: `Deleted ${deleted} Firebase Auth user(s)`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "firebaseauth",
          status: "failed",
          message: "Firebase Auth deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      }
    },
  },

  // ── Elasticsearch ─────────────────────────────────────────────────────────
  {
    key: "elasticsearch",
    transport: "custom",
    label: "Elasticsearch",
    run: async (email: string, creds: Record<string, string>) => {
      const start = Date.now();
      try {
        const indexList = creds.index_names
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (indexList.length === 0) {
          return {
            integration: "elasticsearch",
            status: "failed",
            message: "No Elasticsearch index names provided",
            error: "index_names must be a non-empty comma-separated list",
            durationMs: Date.now() - start,
          };
        }
        // §6.14 — index names are interpolated into the URL path, so each must be a
        // clean identifier (no '/', no '..'). Reject anything that could break out.
        const ES_INDEX_RE = /^[a-z0-9_][a-z0-9_.-]*$/;
        for (const name of indexList) {
          if (!ES_INDEX_RE.test(name)) {
            return {
              integration: "elasticsearch",
              status: "failed",
              message: `Invalid Elasticsearch index name: ${name}`,
              error: "index names must match /^[a-z0-9_][a-z0-9_.-]*$/",
              durationMs: Date.now() - start,
            };
          }
        }
        const indices = indexList.join(",");

        const url = `${creds.endpoint.replace(/\/$/, "")}/${indices}/_delete_by_query`;
        const res = await fetchWithRetry(url, {
          method: "POST",
          headers: {
            Authorization: "ApiKey " + creds.api_key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: { term: { email } } }),
        });

        if (!res.ok) {
          const body = await parseJsonSafe(res);
          return {
            integration: "elasticsearch",
            status: "failed",
            message: `Elasticsearch _delete_by_query failed with HTTP ${res.status}`,
            error: typeof body === "object" ? JSON.stringify(body) : String(body),
            durationMs: Date.now() - start,
          };
        }

        const json = await parseJsonSafe(res);
        const deleted = json.deleted ?? json.total ?? 0;

        if (deleted === 0) {
          return {
            integration: "elasticsearch",
            status: "skipped",
            message: `No documents matched email in indexes`,
            durationMs: Date.now() - start,
          };
        }
        return {
          integration: "elasticsearch",
          status: "success",
          message: `Deleted ${deleted} document(s) from ${indices}`,
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "elasticsearch",
          status: "failed",
          message: "Elasticsearch deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      }
    },
  },

  // ── Substack ──────────────────────────────────────────────────────────────
  {
    key: "substack",
    transport: "custom",
    label: "Substack",
    run: async (email: string, creds: Record<string, string>) => {
      const start = Date.now();
      try {
        // Substack has no public erasure API. We never fake a deletion or make a
        // network call — the request is recorded as a clear, actionable skip so the
        // operator knows manual action is required.
        return {
          integration: "substack",
          status: "skipped",
          message:
            "Substack has no public erasure API; contact support to arrange deletion of this user's data.",
          durationMs: Date.now() - start,
        };
      } catch (e) {
        return {
          integration: "substack",
          status: "failed",
          message: "Substack deletion failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
        };
      }
    },
  },
];

/**
 * Matches a key against a pattern that may contain a single "*" wildcard
 * (e.g. "users/{id}/avatar.png"). Returns true if the key matches.
 * Shared by the AWS S3 and Cloudflare R2 specs.
 */
function wildcardMatch(key: string, pattern: string): boolean {
  if (!pattern.includes("*")) return key === pattern;
  const parts = pattern.split("*");
  // parts[0] is the required prefix; parts[last] is the required suffix.
  const prefix = parts[0];
  const suffix = parts[parts.length - 1];
  if (!key.startsWith(prefix)) return false;
  if (suffix.length > 0 && !key.endsWith(suffix)) return false;
  return true;
}
