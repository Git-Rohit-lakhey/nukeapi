import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Redis-backed rate limiter (Section 6.8).
 * This app runs as Vercel serverless functions across ephemeral instances
 * with no shared memory — an in-memory Map silently fails to enforce limits
 * under real concurrent traffic, so we use Upstash Redis.
 *
 * FAILS OPEN: if Redis is not configured (e.g. local dev), we log a loud
 * warning and allow the request rather than crashing or silently blocking.
 */

let _redis: Redis | null = null;
let _warned = false;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!_warned) {
      console.warn(
        "[ratelimit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting is DISABLED (failing open).",
      );
      _warned = true;
    }
    return null;
  }
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetMs: number;
  limited: boolean;
}

/** Fixed-window counter. Returns whether the request is within limit. */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec = 60,
): Promise<RateLimitResult> {
  const r = getRedis();
  if (!r || limit <= 0) {
    return { success: true, remaining: limit, resetMs: 0, limited: false };
  }
  const k = `rl:${key}`;
  try {
    // Atomic incr + expire via pipeline to prevent key living forever if
    // the serverless function is killed between incr and expire (Section 6.8).
    const [count] = await r.pipeline()
      .incr(k)
      .exec<number[]>();
    if (count === 1) {
      await r.expire(k, windowSec);
    }
    const ttl = await r.ttl(k);
    const remaining = Math.max(0, limit - count);
    return {
      success: count <= limit,
      remaining,
      resetMs: ttl > 0 ? ttl * 1000 : windowSec * 1000,
      limited: count > limit,
    };
  } catch (err) {
    console.error("[ratelimit] Redis error — failing open:", err);
    return { success: true, remaining: limit, resetMs: 0, limited: false };
  }
}
