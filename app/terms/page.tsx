import { LegalLayout } from "@/components/marketing/LegalLayout";
import { LEGAL } from "@/lib/constants/compliance";

export const metadata = {
  title: "Terms of Service",
  description:
    "NukeAPI Terms of Service — acceptable use, plan limits, billing, and liability for the user-deletion API.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="2026-07-18">
      <h2 style={{ fontSize: 20 }}>1. Acceptance of Terms</h2>
      <p>
        By accessing or using NukeAPI (the &quot;Service&quot;, &quot;we&quot;, &quot;us&quot;,
        &quot;our&quot;), you agree to be bound by these Terms of Service. If you do not
        agree, do not use the Service.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>2. Description of Service</h2>
      <p>
        NukeAPI provides a developer API to delete a user&apos;s personal data from
        connected third-party services — including Stripe, Mailchimp, HubSpot,
        Intercom, Supabase and others — in response to data-erasure requests, helping
        businesses comply with regulations such as GDPR and CCPA/CPRA.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>3. Data Controller vs. Data Processor</h2>
      <p>
        You (the customer) are the <strong>Data Controller</strong>. NukeAPI is the
        <strong>Data Processor</strong>. You are solely responsible for ensuring you have
        a lawful basis to request deletion of any personal data submitted to the Service.
        NukeAPI processes data only on your documented instructions.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>4. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul style={{ color: "var(--t2)" }}>
        <li>Use the Service to delete data you do not have legal authority over.</li>
        <li>Attempt to reverse engineer, hack, or disrupt the Service.</li>
        <li>Resell or sublicense access to the Service without written permission.</li>
        <li>Use the Service for any unlawful purpose or to evade legal holds.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>5. API Keys and Security</h2>
      <p>
        You are responsible for maintaining the confidentiality of your API keys. NukeAPI
        stores only a bcrypt hash (plus a deterministic lookup hash) of your key — we
        cannot recover it if lost. Revoke any compromised key immediately from your
        dashboard.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>6. Subscription and Billing</h2>
      <p>
        Paid plans are billed in advance by our merchant of record, Dodo Payments.
        Subscriptions auto-renew until cancelled. You may cancel at any time from your
        dashboard settings — access continues until the end of the current billing period.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>7. Usage Limits and Overages</h2>
      <p>
        Each plan includes a monthly deletion allowance. Usage above your plan limit is
        subject to per-deletion overage fees as specified on the pricing page. NukeAPI may
        throttle accounts that consistently exceed limits without a valid overage arrangement.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>8. Uptime and Availability</h2>
      <p>
        NukeAPI targets 99.9% uptime but does not guarantee uninterrupted service.
        NukeAPI is not liable for downtime caused by third-party services (Stripe,
        Mailchimp, etc.).
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>9. Compliance Obligations</h2>
      <p>
        You remain responsible for responding to data-subject requests within applicable
        deadlines, including:
      </p>
      <ul style={{ color: "var(--t2)" }}>
        <li>{LEGAL.gdpr.body}: {LEGAL.gdpr.maxPenalty}.</li>
        <li>{LEGAL.ccpa.body}: {LEGAL.ccpa.maxPenalty}.</li>
        <li>{LEGAL.lgpd.body}: {LEGAL.lgpd.maxPenalty}.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>10. Audit Reports</h2>
      <p>
        PDF audit reports are generated automatically and cryptographically signed for your
        compliance records. NukeAPI does not guarantee that any audit report will satisfy
        the specific requirements of any regulatory authority — consult your legal counsel.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, NukeAPI shall not be liable for any
        indirect, incidental, special, or consequential damages. Our total aggregate
        liability shall not exceed the amount you paid in the 3 months preceding the claim.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>12. Disclaimer of Warranties</h2>
      <p>
        The Service is provided &quot;as is&quot; without warranties of any kind. NukeAPI
        does not warrant that the Service will meet your specific compliance requirements or
        that deletion operations will be accepted by all third-party services.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>13. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless NukeAPI and its operators from any claims,
        damages, or expenses arising from your use of the Service, violation of these Terms,
        or infringement of any third-party rights.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>14. Modifications to Terms</h2>
      <p>
        We may update these Terms at any time. Continued use of the Service after changes
        constitutes acceptance. Material changes will be communicated via email or dashboard
        notice with at least 14 days&apos; notice.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>15. Dispute Resolution</h2>
      <p>
        Any dispute arising from or related to these Terms or the Service shall be finally
        resolved by binding arbitration under the rules of the London Court of International
        Arbitration (LCIA), with the seat of arbitration in London, England, conducted in
        the English language. Either party may seek urgent interim or injunctive relief from
        any court of competent jurisdiction.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>16. Governing Law</h2>
      <p>
        These Terms and any dispute or claim arising out of or in connection with them
        (including non-contractual disputes or claims) shall be governed by and construed
        in accordance with the laws of England and Wales. Nothing in these Terms affects any
        mandatory consumer-protection rights you may have under the law of your country of
        residence.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>17. Severability</h2>
      <p>
        If any provision of these Terms is found to be unenforceable, the remaining
        provisions will continue in full force and effect.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>18. Contact</h2>
      <p>
        For questions about these Terms, contact us at{" "}
        <a href="mailto:hello@nukeapi.dev" style={{ color: "var(--lime)" }}>
          hello@nukeapi.dev
        </a>
        .
      </p>
    </LegalLayout>
  );
}
