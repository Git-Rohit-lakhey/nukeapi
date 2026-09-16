import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AuditSubject } from "@/types/deletion";

export interface AuditPdfInput extends AuditSubject {
  auditSignature: string;
  generatedAt: string;
  /**
   * White-label mode (Enterprise). When true, the NukeAPI wordmark is omitted
   * from the header so the report can be handed to auditors/clients under the
   * customer's own branding. The document remains cryptographically identical
   * (same signature over the same canonical result).
   */
  whiteLabel?: boolean;
  /** Optional custom header title used in white-label mode. */
  brandTitle?: string;
}

const VOID = rgb(0.031, 0.031, 0.031);
const LIME = rgb(0.784, 1, 0);
const GREY = rgb(0.63, 0.63, 0.63);
const WHITE = rgb(1, 1, 1);

/**
 * Generate a cryptographically-signed PDF audit trail. The HMAC-SHA256
 * signature (computed over the canonical result in lib/security/signing.ts)
 * is embedded in the footer and is independently re-verifiable — the document
 * is proof of what happened, when, and for whom (Section 6.6).
 */
export async function generateAuditPdf(input: AuditPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const M = 56;
  let y = 842 - M;

  const line = (text: string, size = 11, color = WHITE, f = font, x = M) => {
    page.drawText(text, { x, y, size, font: f, color });
    y -= size + 7;
  };
  const gap = (n = 10) => {
    y -= n;
  };

  page.drawRectangle({ x: 0, y: 842 - 90, width: 595, height: 90, color: VOID });
  if (input.whiteLabel) {
    // White-label: neutral branding, no NukeAPI wordmark.
    page.drawText(input.brandTitle ?? "Data Deletion Audit Trail", {
      x: M,
      y: 842 - 52,
      size: 20,
      font,
      color: WHITE,
    });
    page.drawText("Compliance record", {
      x: M,
      y: 842 - 74,
      size: 12,
      font,
      color: GREY,
    });
  } else {
    page.drawText("NukeAPI", { x: M, y: 842 - 52, size: 24, font, color: LIME });
    page.drawText("Deletion Audit Trail", {
      x: M,
      y: 842 - 74,
      size: 12,
      font,
      color: WHITE,
    });
  }
  y = 842 - 110;

  line(`Request ID:     ${input.requestId}`, 11, WHITE, mono);
  line(`Subject email:  ${input.subjectEmail}`, 11, WHITE, mono);
  line(`Status:         ${input.status.toUpperCase()}`, 11, LIME, font);
  line(`Started:        ${input.startedAt}`, 11, WHITE, mono);
  line(`Completed:      ${input.completedAt}`, 11, WHITE, mono);
  gap(12);

  line("Per-integration results", 13, LIME, font);
  for (const r of input.results) {
    const color =
      r.status === "success" ? LIME : r.status === "failed" ? rgb(1, 0.31, 0.31) : GREY;
    line(`  [${r.status.toUpperCase().padEnd(8)}] ${r.integration}`, 11, color, mono);
    line(`       ${r.message}`, 10, WHITE, font);
  }
  gap(16);

  page.drawText("Cryptographic signature", { x: M, y, size: 13, font, color: LIME });
  y -= 20;
  // Wrap the signature hex across lines.
  const sig = input.auditSignature;
  const step = 76;
  for (let i = 0; i < sig.length; i += step) {
    page.drawText(sig.slice(i, i + step), { x: M, y, size: 9, font: mono, color: WHITE });
    y -= 13;
  }
  y -= 8;
  page.drawText(
    input.whiteLabel
      ? "HMAC-SHA256 over the canonical result. Independently re-verifiable."
      : "HMAC-SHA256 over the canonical result. Independently verifiable by NukeAPI.",
    { x: M, y, size: 9, font, color: GREY },
  );
  y -= 14;
  page.drawText(`Generated: ${input.generatedAt}`, { x: M, y, size: 9, font, color: GREY });

  return doc.save();
}
