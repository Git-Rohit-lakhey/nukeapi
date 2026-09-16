import { ALL_CONNECTOR_META } from "@/lib/connectors/meta";

/** "What gets deleted" per integration, shown in the docs Available Integrations table. */
const DELETIONS: Record<string, string> = {
  stripe: "Customer record, payment methods (safe — does not cancel active subscriptions)",
  mailchimp: "Subscriber from all lists and audiences",
  hubspot: "Contact record and associated activities",
  intercom: "User/lead record and conversation history",
  supabase: "User from your Supabase project's auth.users",
  postgresql: "Row(s) in the configured table matching the email (identifiers validated server-side)",
};

export function DocsIntegrations() {
  const rows = [...ALL_CONNECTOR_META].sort((a, b) => a.label.localeCompare(b.label));

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
        {rows.map((m) => (
          <tr key={m.key}>
            <td>
              <code>{m.key}</code>
            </td>
            <td>{m.label}</td>
            <td style={{ color: "#686878", fontSize: 13 }}>
              {DELETIONS[m.key] ?? `User data from ${m.label}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
