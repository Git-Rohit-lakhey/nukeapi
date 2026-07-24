import type { ConnectorResult, RedisCredentials } from "@/types/connector";

/**
 * Upstash Redis connector. Real deletion via the @upstash/redis REST driver.
 *
 * Keys are resolved with a SCAN loop over the user-supplied glob pattern
 * (the email is typically already embedded in key_pattern, e.g.
 * "users:*:email@example.com"), then deleted in a single DEL call. The
 * pattern is treated as opaque — never interpolated into code, only passed to
 * Redis as a match argument.
 */
export async function deleteRedis(
  email: string,
  creds: RedisCredentials,
): Promise<ConnectorResult> {
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
}
