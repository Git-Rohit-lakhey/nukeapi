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

  return (
    <div>
      <p className="eyebrow">overview</p>
      <h1 style={{ fontSize: 30 }}>Welcome back</h1>

      <div className="grid grid-3" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="dim" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
            PLAN
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
            {PLANS[plan as keyof typeof PLANS]?.label ?? plan}
          </div>
          <span className="badge badge-lime" style={{ marginTop: 8 }}>
            {sub?.status ?? "active"}
          </span>
        </div>
        <div className="card">
          <div className="dim" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
            DELETIONS THIS MONTH
          </div>
          <div className="stat" style={{ marginTop: 4 }}>
            {used}
            <span style={{ color: "var(--t3)", fontSize: 16 }}> / {limit === Infinity ? "∞" : limit}</span>
          </div>
          <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
            {remaining === Infinity ? "unlimited remaining" : `${remaining} remaining`}
            {overageRate ? ` · $${overageRate}/extra` : ""}
          </div>
        </div>
        <div className="card">
          <div className="dim" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
            SUCCESS RATE
          </div>
          <div className="stat" style={{ marginTop: 4, color: "var(--emerald)" }}>
            {successRate}%
          </div>
          <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
            {total} recent request(s)
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 16 }}>Connected integrations</h3>
          {connectedList.length === 0 ? (
            <p style={{ marginTop: 8 }}>
              None yet. <Link href="/connectors" style={{ color: "var(--lime)" }}>Connect one →</Link>
            </p>
          ) : (
            <div className="flex wrap gap-8" style={{ marginTop: 8 }}>
              {connectedList.map((c) => (
                <span key={c} className="badge badge-success">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 16 }}>Quick start</h3>
          <p style={{ marginTop: 8 }}>
            Send a deletion with your API key:
          </p>
          <pre className="codeblock" style={{ marginTop: 8, fontSize: 12 }}>
{`curl -X POST ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/v1/delete-user \\
  -H "Authorization: Bearer nk_live_..." \\
  -d '{"subject_email":"user@x.com"}'`}
          </pre>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 16 }}>Recent activity</h3>
        {reqs.length === 0 ? (
          <p style={{ marginTop: 8 }}>No deletions yet.</p>
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
                  <td>{r.subject_email}</td>
                  <td>
                    <span
                      className={`badge badge-${r.status === "failed" ? "failed" : r.status === "completed" ? "success" : "skipped"}`}
                    >
                      {r.status}
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
