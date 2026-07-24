import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { errorResponse, withErrorHandler } from "@/lib/engine/errors";
import { Resend } from "resend";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    page?: string;
  };
  const message = (body.message ?? "").trim();
  if (!message) return errorResponse("INVALID_BODY", "Message is required", 400);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("feedback").insert({
    user_id: user?.id ?? null,
    message,
    page: body.page ?? null,
  });
  if (error) return errorResponse("INTERNAL_ERROR", "Failed to save feedback", 500);

  // Best-effort email notification.
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SUPPORT_TO_EMAIL;
  const from = process.env.SUPPORT_FROM_EMAIL;
  if (apiKey && to && from) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from,
        to,
        subject: `NukeAPI feedback from ${user?.email ?? "guest"}`,
        text: `Page: ${body.page ?? "n/a"}\n\n${message}`,
      });
    } catch (e) {
      console.error("[feedback] email notify failed:", e);
    }
  }

  return NextResponse.json({ success: true, data: { received: true } });
});
