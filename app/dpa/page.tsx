import { LegalLayout } from "@/components/marketing/LegalLayout";
import { SUB_PROCESSORS } from "@/lib/constants/compliance";

export const metadata = {
  title: "Data Processing Addendum",
  description:
    "NukeAPI Data Processing Addendum — sub-processors, GDPR Article 28 terms, and data-handling commitments.",
  alternates: { canonical: "/dpa" },
};

export default function DpaPage() {
  return (
    <LegalLayout title="Data Processing Addendum (DPA)" updated="2026-07-18">
      <p>
        This DPA is incorporated into and forms part of the NukeAPI Terms of Service.
        By using NukeAPI, you agree to this DPA.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>1. Definitions</h2>
      <p>
        <strong>Controller:</strong> The customer (you) who determines the purposes and
        means of processing personal data.
      </p>
      <p>
        <strong>Processor:</strong> NukeAPI, who processes personal data on behalf of the
        Controller.
      </p>
      <p>
        <strong>Personal Data:</strong> Any information relating to an identified or
        identifiable natural person submitted to the Service.
      </p>
      <p>
        <strong>Processing:</strong> The deletion operations performed on personal data
        via the NukeAPI service.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>2. Scope of Processing</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Subject matter</td><td>Deletion of personal data from third-party services</td></tr>
          <tr><td>Duration</td><td>For the term of the service agreement</td></tr>
          <tr><td>Nature</td><td>Automated deletion via API calls to connected services</td></tr>
          <tr><td>Purpose</td><td>GDPR Art. 17 / CCPA-CPRA compliance — right to erasure</td></tr>
          <tr><td>Types of data</td><td>Email addresses, user IDs submitted by the Controller</td></tr>
          <tr><td>Categories of subjects</td><td>End-users of the Controller&apos;s service</td></tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>3. Processor Obligations</h2>
      <ul style={{ color: "var(--t2)" }}>
        <li>Process personal data only on documented instructions from the Controller.</li>
        <li>Ensure all personnel processing data are bound by confidentiality.</li>
        <li>Implement appropriate technical and organisational security measures.</li>
        <li>Not engage sub-processors without prior notification (see Section 6).</li>
        <li>Assist the Controller in responding to data-subject rights requests.</li>
        <li>Delete or return all personal data upon termination of services.</li>
        <li>Provide all information necessary to demonstrate compliance with this DPA.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>4. Controller Obligations</h2>
      <ul style={{ color: "var(--t2)" }}>
        <li>Have a lawful basis for submitting personal data to NukeAPI.</li>
        <li>Ensure data subjects have been notified of deletion where required.</li>
        <li>Only submit data for which they have legal authority to request deletion.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>5. Security Measures</h2>
      <ul style={{ color: "var(--t2)" }}>
        <li>AES-256-GCM encryption of credentials at rest.</li>
        <li>TLS 1.2+ for all data in transit.</li>
        <li>API-key authentication with bcrypt hashing.</li>
        <li>Row-level security on all database tables.</li>
        <li>Access logging and signed audit trails for all deletion operations.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>6. Sub-processors</h2>
      <p>
        The following sub-processors may process personal data on our behalf. This list is
        the single source of truth shared with our Privacy Policy:
      </p>
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

      <h2 style={{ fontSize: 20, marginTop: 24 }}>7. International Transfers</h2>
      <p>
        Data may be transferred to and processed in countries outside your home jurisdiction.
        NukeAPI ensures all such transfers are protected by appropriate safeguards including
        Standard Contractual Clauses (SCCs), adequacy decisions, or equivalent
        internationally recognised transfer mechanisms.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>8. Data Retention and Deletion</h2>
      <p>
        NukeAPI retains deletion-request logs and audit trails for 90 days, after which
        they are permanently purged. Upon termination of your account, all personal data
        associated with your account is deleted within 30 days.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>9. Breach Notification</h2>
      <p>
        In the event of a personal-data breach, NukeAPI will notify the Controller without
        undue delay and no later than 72 hours after becoming aware, providing sufficient
        information to allow the Controller to meet any applicable notification obligations.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>10. Audit Rights</h2>
      <p>
        The Controller may request an audit of NukeAPI&apos;s data-processing activities no
        more than once per year, with 30 days&apos; written notice, at the
        Controller&apos;s expense.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>11. Contact</h2>
      <p>
        For DPA requests or questions:{" "}
        <a href="mailto:hello@nukeapi.dev" style={{ color: "var(--lime)" }}>
          hello@nukeapi.dev
        </a>
      </p>
    </LegalLayout>
  );
}
