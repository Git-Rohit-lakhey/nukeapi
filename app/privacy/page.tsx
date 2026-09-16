import { LegalLayout } from "@/components/marketing/LegalLayout";
import { SUB_PROCESSORS } from "@/lib/constants/compliance";

export const metadata = {
  title: "Privacy Policy",
  description:
    "NukeAPI Privacy Policy — what data we collect, how credentials are encrypted at rest (AES-256-GCM), and your rights.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="2026-07-18">
      <h2 style={{ fontSize: 20 }}>1. Who We Are</h2>
      <p>
        NukeAPI provides a global data-deletion API service. Contact:{" "}
        <a href="mailto:hello@nukeapi.dev" style={{ color: "var(--lime)" }}>
          hello@nukeapi.dev
        </a>
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>2. Data We Collect</h2>
      <p>
        <strong>Account data:</strong> Email address and an encrypted password when you
        register.
      </p>
      <p>
        <strong>API usage data:</strong> Deletion-request logs, timestamps, integration
        names, and job statuses. We log outcomes, not the personal data being deleted.
      </p>
      <p>
        <strong>Integration credentials:</strong> API keys you provide for third-party
        services are stored AES-256-GCM encrypted. We never log them in plaintext.
      </p>
      <p>
        <strong>API keys:</strong> We store only a bcrypt hash (plus a deterministic
        lookup hash) — never the raw key.
      </p>
      <p>
        <strong>Billing data:</strong> Managed entirely by Dodo Payments, our merchant of
        record. We do not store payment-card information.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>3. Data We Do Not Collect</h2>
      <ul style={{ color: "var(--t2)" }}>
        <li>We do not store the personal data of your end-users being deleted.</li>
        <li>We do not sell your data to third parties.</li>
        <li>We do not use your data for advertising.</li>
        <li>We do not store raw API keys — only bcrypt hashes.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>4. How We Use Your Data</h2>
      <ul style={{ color: "var(--t2)" }}>
        <li>To authenticate your API requests.</li>
        <li>To generate PDF audit trails for your compliance records.</li>
        <li>To display usage statistics in your dashboard.</li>
        <li>To send transactional emails (receipts, account changes).</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>5. Sub-processors</h2>
      <p>We use the following sub-processors to deliver NukeAPI:</p>
      <table className="table">
        <thead>
          <tr>
            <th>Sub-processor</th>
            <th>Purpose</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {SUB_PROCESSORS.map((s) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>{s.purpose}</td>
              <td>{s.location}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>6. Data Retention</h2>
      <p>
        Deletion-request logs and PDF audit trails are retained for 90 days, then
        permanently deleted. Account data is retained until you delete your account;
        credentials are encrypted and deleted when you disconnect an integration or delete
        your account. You may request immediate deletion by emailing{" "}
        <a href="mailto:hello@nukeapi.dev" style={{ color: "var(--lime)" }}>
          hello@nukeapi.dev
        </a>
        .
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>7. Your Privacy Rights</h2>
      <p>
        Regardless of where you are located, you have the right to access, correct,
        export, or delete your personal data held by NukeAPI. This includes rights under
        GDPR, CCPA/CPRA, LGPD, and equivalent laws worldwide. Contact us at{" "}
        <a href="mailto:hello@nukeapi.dev" style={{ color: "var(--lime)" }}>
          hello@nukeapi.dev
        </a>
        . We will respond within 30 days and will never sell your data to third parties.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>8. International Data Transfers</h2>
      <p>
        Data may be transferred to and processed in countries outside your home
        jurisdiction. NukeAPI ensures all such transfers are protected by appropriate
        safeguards including Standard Contractual Clauses or equivalent internationally
        recognised transfer mechanisms.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>9. Cookies</h2>
      <p>
        We use only essential session cookies required for authentication. We do not use
        tracking or advertising cookies.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>10. Security</h2>
      <p>
        All data is transmitted over HTTPS/TLS 1.2+. Credentials are encrypted at rest
        with AES-256-GCM. API keys are never stored in plaintext. We conduct regular
        security reviews and follow industry best practices.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>11. Changes to This Policy</h2>
      <p>
        We may update this policy periodically. We will notify you of material changes
        via email or dashboard notice.
      </p>
    </LegalLayout>
  );
}
