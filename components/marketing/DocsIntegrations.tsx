"use client";

import { useEffect, useState } from "react";
import { ALL_CONNECTOR_META } from "@/lib/connectors/meta";

/**
 * "What gets deleted" per integration, shown in the docs Available
 * Integrations table. Only VISIBLE (admin-released, not hidden, not in
 * maintenance) connectors are rendered — hidden ones never appear.
 */
const DELETIONS: Record<string, string> = {
  stripe: "Customer record, payment methods (safe — does not cancel active subscriptions)",
  mailchimp: "Subscriber from all lists and audiences",
  hubspot: "Contact record and associated activities",
  intercom: "User/lead record and conversation history",
  supabase: "Row(s) in auth.users and any linked table you configure",
  postgresql: "Row(s) in the configured table matching the email (identifiers validated server-side)",
  salesforce: "Contact record(s) matching the email (SOQL search, paginated)",
  segment: "User suppressed/deleted via the Regulation API (by user_id = email)",
  klaviyo: "Profile(s) matching the email",
  sendgrid: "Marketing contact(s) matching the email",
  auth0: "User record(s) from your Auth0 tenant",
  clerk: "User record(s) from your Clerk organization",
  posthog: "Person(s) matching the email",
  zendesk: "End-user record(s) matching the email",
  mixpanel: "People profile(s) for the email’s distinct_id",
  mysql: "Row(s) in the configured table matching the email (identifiers validated)",
  planetscale: "Row(s) in the configured table matching the email",
  neon: "Row(s) in the configured table matching the email",
  mongodb: "Document(s) in the configured collection matching the email",
  firestore: "Document(s) in the configured collection matching the email",
  convertkit: "Subscriber and tags matching the email",
  activecampaign: "Contact and associated lists/automations matching the email",
  resend: "Contact from the configured Resend audience",
  drip: "Subscriber record matching the email",
  amplitude: "User profile and all event data matching the email",
  fullstory: "User record and all session replays matching the email",
  heap: "User identity and captured events matching the email",
  june: "User profile matching the email",
  paddle: "Customer record matching the email",
  chargebee: "Customer and subscription record matching the email",
  recurly: "Account record matching the email",
  braintree: "Customer record matching the email",
  pipedrive: "Contact and deal history matching the email",
  freshdesk: "Contact and ticket history matching the email",
  crisp: "Contact and conversation history matching the email",
  firebaseauth: "User account from the Firebase project",
  okta: "User account from the Okta organization",
  stytch: "User object from the Stytch project",
  // Batch 2 (hidden by default until admin releases)
  turso: "Row(s) in the configured table matching the email (identifiers validated)",
  redis: "Key(s) matching the configured user-id / email pattern",
  elasticsearch: "Document(s) across configured indexes matching the email",
  cassandra: "Row(s) in the configured table matching the email (identifiers validated)",
  workos: "Directory user record matching the email",
  passage: "User account matching the email (1Password Passage)",
  cognito: "User from the configured AWS Cognito user pool",
  keycloak: "User from the configured Keycloak realm",
  brevo: "Contact from all lists (Brevo / ex-Sendinblue)",
  omnisend: "Contact and segments matching the email (Omnisend)",
  beehiiv: "Subscriber matching the email (Beehiiv)",
  substack: "No public erasure API — contact support to arrange deletion",
  loops: "Contact matching the email (Loops)",
  customerio: "Person and all attributes matching the email (Customer.io)",
  linear: "User account matching the email (Linear)",
  helpscout: "Customer and email threads matching the email (Help Scout)",
  gorgias: "Customer and tickets matching the email (Gorgias)",
  groove: "Contact and tickets matching the email (Groove)",
  smartlook: "Visitor and session data matching the email (Smartlook)",
  logrocket: "Session data matching the email (LogRocket)",
  datadog: "User record and associated logs/traces where addressable by email (Datadog)",
  pendo: "Visitor profile and events matching the email (Pendo)",
  lemonsqueezy: "Customer record matching the email (Lemon Squeezy)",
  gumroad: "Customer record matching the email (Gumroad)",
  zuora: "Account and subscription matching the email (Zuora)",
  awss3: "Objects under the configured user prefix (AWS S3)",
  cloudflarer2: "Objects under the configured user prefix (Cloudflare R2)",
  googlecloudstorage: "Objects under the configured user prefix (Google Cloud Storage)",
  vercelblob: "Blobs under the configured user prefix (Vercel Blob)",
  twilio: "Contact/SMS records addressable by email where present (Twilio)",
  vonage: "Contact record matching the email (Vonage / Nexmo)",
  plivo: "User data matching the email (Plivo)",
  notion: "Pages storing the user’s data, where found via the integration token (Notion)",
  airtable: "Records across configured tables matching the email (Airtable)",
  webflow: "CMS item and member matching the email (Webflow)",
  memberstack: "Member account matching the email (Memberstack)",
  outseta: "Contact record matching the email (Outseta)",
  braze: "User profile matching the email (Braze)",
  iterable: "User profile and events matching the email (Iterable)",
  vero: "User record matching the email (Vero)",
};

export function DocsIntegrations() {
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/connectors/availability")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.data?.integrations)) {
          setVisible(
            new Set(
              (d.data.integrations as Array<{ key: string; visible: boolean }>)
                .filter((i) => i.visible)
                .map((i) => i.key),
            ),
          );
        }
      })
      .catch(() => {
        /* leave empty — nothing shown until loaded */
      })
      .finally(() => setLoaded(true));
  }, []);

  const rows = ALL_CONNECTOR_META.filter((m) => visible.has(m.key)).sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  return (
    <table>
      <thead>
        <tr>
          <th>Key</th>
          <th>Service</th>
          <th>What gets deleted</th>
        </tr>
      </thead>
      <tbody>
        {loaded && rows.length === 0 ? (
          <tr>
            <td colSpan={3} style={{ color: "#686878", fontSize: 13 }}>
              No integrations are currently released.
            </td>
          </tr>
        ) : (
          rows.map((m) => (
            <tr key={m.key}>
              <td>
                <code>{m.key}</code>
              </td>
              <td>{m.label}</td>
              <td style={{ color: "#686878", fontSize: 13 }}>
                {DELETIONS[m.key] ?? `User data from ${m.label}`}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
