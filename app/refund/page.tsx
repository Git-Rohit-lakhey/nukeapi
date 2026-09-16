import { LegalLayout } from "@/components/marketing/LegalLayout";

export const metadata = {
  title: "Refund Policy",
  description:
    "NukeAPI Refund Policy — when refunds apply, how to request one, and processing timelines.",
  alternates: { canonical: "/refund" },
};

export default function RefundPage() {
  return (
    <LegalLayout title="Refund Policy" updated="2026-07-18">
      <h2 style={{ fontSize: 20 }}>1. Free Tier</h2>
      <p>
        The free tier (Sandbox plan) includes 20 deletions per month at no charge. No
        payment is required and no refund is applicable.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>2. Paid Plans — 14-Day Money-Back Guarantee</h2>
      <p>
        NukeAPI offers a <strong>14-day money-back guarantee</strong> on all paid plans
        (Startup, Business, Enterprise). If you are unsatisfied within the first 14 days
        of your first payment, contact us at{" "}
        <a href="mailto:hello@nukeapi.dev" style={{ color: "var(--lime)" }}>
          hello@nukeapi.dev
        </a>{" "}
        for a full refund — no questions asked.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>3. After 14 Days</h2>
      <p>
        After the 14-day window, subscriptions are non-refundable. You may cancel at any
        time from your dashboard settings — your access will continue until the end of the
        current billing period and you will not be charged again.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>4. Overage Charges</h2>
      <p>
        Overage charges (per-deletion fees above your plan limit) are non-refundable once
        the API calls have been successfully processed and logged in your audit trail.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>5. Service Downtime</h2>
      <p>
        If NukeAPI experiences downtime exceeding 24 continuous hours in a single calendar
        month, affected customers on paid plans are eligible for a pro-rated credit for that
        period. Credits are applied to the next billing cycle and are not redeemable as cash.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>6. How to Request a Refund</h2>
      <p>
        Email{" "}
        <a href="mailto:hello@nukeapi.dev" style={{ color: "var(--lime)" }}>
          hello@nukeapi.dev
        </a>{" "}
        with your account email, the date of payment, and the reason for the request. We
        process all refund requests within 5 business days. Refunds are returned to the
        original payment method.
      </p>
    </LegalLayout>
  );
}
