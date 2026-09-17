import Link from "next/link";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { getPlanLimits, PLANS } from "@/lib/constants/compliance";
import { getPeriodBounds } from "@/lib/engine/metering";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = getSupabaseAdmin();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan,status")
    .eq("user_id", user.id)
    .maybeSingle();
  const plan = sub?.plan ?? "free";
  const { limit, overageRate } = getPlanLimits(plan);

  const { start } = getPeriodBounds();
  const { data: usageRow } = await admin
    .from("usage_meters")
    .select("deletion_count")
    .eq("user_id", user.id)
    .eq("period_start", start.toISOString().slice(0, 10))
    .maybeSingle();
  const used = usageRow?.deletion_count ?? 0;
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used);

  const { data: recent } = await admin
    .from("deletion_requests")
    .select("id,subject_email,status,created_at,integrations_completed")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: connected } = await admin
    .from("connector_credentials")
    .select("integration")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const reqs = recent ?? [];
  const total = reqs.length;
  const okCount = reqs.filter((r) => r.status === "completed" || r.status === "partial").length;
  const successRate = total ? Math.round((okCount / total) * 100) : 100;
  const connectedList = (connected ?? []).map((c) => c.integration);

  const pct = limit === Infinity ? 100 : limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const needsAttention = limit !== Infinity && remaining <= Math.max(2, Math.ceil(limit * 0.1));

  return (
    <div className="anim-fadeUp">
      <p className="eyebrow">overview</p>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>Welcome back</h1>
        <span className="badge badge-lime"><span className="dot" />{PLANS[plan as keyof typeof PLANS]?.label ?? plan} · {sub?.status ?? "active"}</span>
      </div>

      <div className="grid grid-3" style={{ marginTop: 22 }}>
        <div className="card card-hover">
          <div className="stat-label">plan</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
            {PLANS[plan as keyof typeof PLANS]?.label ?? plan}
          </div>
          <div className="dim" style={{ fontSize: 12.5, marginTop: 6 }}>
            {plan === "free" ? "Sandbox · upgrade for PDF + more quota" : `Billed via Dodo · ${sub?.status ?? ""}`}
          </div>
          {plan === "free" && (
            <Link href="/settings" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Upgrade →</Link>
          )}
        </div>
        <div className="card card-hover">
          <div className="stat-label">deletions this month</div>
          <div className="stat" style={{ marginTop: 6 }}>
            {used}
            <span style={{ color: "var(--t3)", fontSize: 16, fontWeight: 500 }}> / {limit === Infinity ? "∞" : limit}</span>
          </div>
          <div className="progress" style={{ marginTop: 12 }}><span style={{ width: `${pct}%` }} /></div>
          <div className="dim" style={{ fontSize: 12, marginTop: 8, color: needsAttention ? "var(--amber)" : undefined }}>
            {remaining === Infinity ? "unlimited remaining" : `${remaining} remaining`}
            {overageRate ? ` · $${overageRate}/extra` : ""}
            {needsAttention ? " · running low — upgrade" : ""}
          </div>
        </div>
        <div className="card card-hover">
          <div className="stat-label">success rate</div>
          <div className="stat" style={{ marginTop: 6, color: successRate >= 90 ? "var(--emerald)" : successRate >= 60 ? "var(--amber)" : "var(--rose)" }}>
            {successRate}%
          </div>
          <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>
            {total} recent request{total === 1 ? "" : "s"} · partial completions included
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card card-hover">
          <h3 style={{ fontSize: 15 }}>🔌 Connected integrations</h3>
          {connectedList.length === 0 ? (
            <div className="empty" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>🔌</div>
              <div style={{ fontWeight: 700, color: "var(--t2)", fontSize: 13.5 }}>Nothing connected yet</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>Connect an integration to send your first deletion.</div>
              <Link href="/connectors" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Connect one →</Link>
            </div>
          ) : (
            <div className="flex wrap gap-8" style={{ marginTop: 12 }}>
              {connectedList.map((c) => (
                <span key={c} className="badge badge-success">
                  <span className="dot" />{c}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="card card-hover">
          <h3 style={{ fontSize: 15 }}>⚡ Quick start</h3>
          <p style={{ marginTop: 8, fontSize: 13 }}>
            Send a deletion with your API key:
          </p>
          <pre className="codeblock" style={{ marginTop: 10, fontSize: 11.5 }}>
{`curl -X POST ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/v1/delete-user \\
  -H "Authorization: Bearer nk_live_..." \\
  -d '{"subject_email":"user@x.com"}'`}
          </pre>
          <Link href="/keys" style={{ color: "var(--lime)", fontSize: 13, marginTop: 10, display: "inline-block" }}>Get a key →</Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 15, margin: 0 }}>🧾 Recent activity</h3>
          {reqs.length > 0 && <Link href="/requests" style={{ color: "var(--lime)", fontSize: 13 }}>View all →</Link>}
        </div>
        {reqs.length === 0 ? (
          <div className="empty" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>🧾</div>
            <div style={{ fontWeight: 700, color: "var(--t2)", fontSize: 13.5 }}>No deletions yet</div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>Your API calls will appear here with per-integration results.</div>
          </div>
        ) : (
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Status</th>
                <th>Completed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reqs.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontSize: 12.5 }}>{r.subject_email}</td>
                  <td>
                    <span
                      className={`badge badge-${r.status === "failed" ? "failed" : r.status === "completed" ? "success" : "skipped"}`}
                    >
                      <span className="dot" />{r.status}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {(r.integrations_completed ?? []).join(", ") || "—"}
                  </td>
                  <td>
                    <Link href="/requests" style={{ color: "var(--lime)", fontSize: 13 }}>
                      view
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
