import "server-only";
import { Resend } from "resend";

/**
 * Transactional email via Resend (Section 2 stack). Best-effort: returns a
 * boolean rather than throwing, so a mail hiccup can never break a deletion
 * request. The caller decides whether the send was gated by plan.
 */
export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SUPPORT_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[notify/email] RESEND_API_KEY or SUPPORT_FROM_EMAIL unset — skipping email");
    return false;
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
    if (error) {
      console.error("[notify/email] Resend returned error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[notify/email] send failed:", e);
    return false;
  }
}
