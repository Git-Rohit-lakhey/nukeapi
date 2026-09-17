import { ALL_CONNECTOR_META } from "@/lib/connectors/meta";
import { getAllConnectorFlags } from "@/lib/connectors/flags";
import { isRegisteredIntegration } from "@/lib/connectors/index";

/** "What gets deleted" per integration, shown in the docs Available Integrations table. */
const DELETIONS: Record<string, string> = {
  stripe: "Customer record, payment methods (safe — does not cancel active subscriptions)",
  mailchimp: "Subscriber from all lists and audiences",
  hubspot: "Contact record and associated activities",
  intercom: "User/lead record and conversation history",
  supabase: "User from your Supabase project's auth.users",
  postgresql: "Row(s) in the configured table matching the email (identifiers validated server-side)",
};

export async function DocsIntegrations() {
  const flags = await getAllConnectorFlags();
  const byKey = new Map(flags.map((f) => [f.integration, f]));
  const rows = [...ALL_CONNECTOR_META].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <table>
      <thead>
        <tr>
          <th>Key</th>
          <th>Service</th>
          <th>Status</th>
          <th>What gets deleted</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => {
          const f = byKey.get(m.key);
          const usable = f ? f.enabled && !f.hidden && !f.maintenance : m.enabledByDefault;
          const maint = f?.maintenance ?? false;
          const live = usable && isRegisteredIntegration(m.key);
          const status = maint ? "Maintenance" : live ? "Live" : "Coming soon";
          return (
            <tr key={m.key} style={live ? undefined : { opacity: 0.72 }}>
              <td>
                <code>{m.key}</code>
              </td>
              <td>{m.label}</td>
              <td style={{ fontSize: 12, color: maint ? "#f5a623" : live ? "#c8f135" : "#6a6a80" }}>
                {status}
              </td>
              <td style={{ color: "#686878", fontSize: 13 }}>
                {DELETIONS[m.key] ?? `User data from ${m.label}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
