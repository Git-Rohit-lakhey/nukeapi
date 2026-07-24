import type { ConnectorResult, AwsS3Credentials } from "@/types/connector";

/**
 * Matches a key against a pattern that may contain a single "*" wildcard
 * (e.g. "users/{id}/avatar.png"). Returns true if the key matches.
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

export async function deleteAwsS3(
  _email: string,
  creds: AwsS3Credentials,
): Promise<ConnectorResult> {
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
}
