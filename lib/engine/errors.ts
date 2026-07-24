import { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/types/api";

/** Central API error type. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/**
 * Wrap a route handler so any thrown error becomes a structured JSON response
 * instead of leaking a stack trace. ApiError carries its own status/code.
 */
export function withErrorHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return errorResponse(err.code, err.message, err.status);
      }
      console.error("[api] unhandled error:", err);
      return errorResponse(
        "INTERNAL_ERROR",
        "An unexpected error occurred",
        500,
      );
    }
  };
}
