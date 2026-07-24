import type { ConnectorResult, Integration } from "@/types/connector";

/** Consistent ConnectorResult constructors (status / message / timing). */
export function okResult(
  key: Integration,
  message: string,
  start: number,
): ConnectorResult {
  return { integration: key, status: "success", message, durationMs: Date.now() - start };
}

export function skipResult(
  key: Integration,
  message: string,
  start: number,
): ConnectorResult {
  return { integration: key, status: "skipped", message, durationMs: Date.now() - start };
}

export function failResult(
  key: Integration,
  message: string,
  start: number,
  error?: string,
): ConnectorResult {
  return { integration: key, status: "failed", message, durationMs: Date.now() - start, error };
}

/** Coerce an unknown response field into an array. */
export function toArray(x: unknown): any[] {
  if (Array.isArray(x)) return x;
  if (x == null) return [];
  return [x];
}
