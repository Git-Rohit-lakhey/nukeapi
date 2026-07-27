import { redirect } from "next/navigation";
import { getSessionUser, getSupabaseAdmin } from "@/lib/db/supabase";
import { PLANS } from "@/lib/constants/compliance";
import { OwnerConnectors } from "@/components/dashboard/OwnerConnectors";

export const dynamic = "force-dynamic";

function monthlyEquivalent(plan: string): number {
  const def = PLANS[plan as keyof typeof PLANS];
  if (!def) return 0;
  return def.billing === "yearly" ? def.priceYearly / 12 : def.priceMonthly;
}

export default async function OwnerPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const ownerEmails = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!ownerEmails.includes(user.email.toLowerCase())) redirect("/dashboard");

  const admin = getSupabaseAdmin();

  const { data: subs } = await admin.from("subscriptions").select("plan,status,user_id");
  const allSubs = subs ?? [];

  const totalUsers = new Set(allSubs.map((s) => s.user_id)).size;
  const paying = allSubs.filter((s) => s.plan !== "free" && s.status === "active");
  const mrr = paying.reduce((sum, s) => sum + monthlyEquivalent(s.plan), 0);

  const { count: totalDeletions } = await admin
    .from("deletion_requests")
    .select("id", { count: "exact", head: true });

  const { data: recent } = await admin
    .from("subscriptions")
    .select("plan,status,user_id,current_period_end")
    .neq("plan", "free")
    .order("user_id")
    .limit(25);

  const { data: recentFeedback } = await admin
    .from("feedback")
    .select("id, user_id, message, page, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <p className="eyebrow">owner</p>
      <h1 style={{ fontSize: 30 }}>Internal metrics</h1>

      <div className="grid grid-3" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="dim" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>MRR</div>
          <div className="stat" style={{ marginTop: 4 }}>${Math.round(mrr).toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="dim" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>PAYING USERS</div>
          <div className="stat" style={{ marginTop: 4 }}>{paying.length}</div>
        </div>
        <div className="card">
          <div className="dim" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>TOTAL USERS</div>
          <div className="stat" style={{ marginTop: 4 }}>{totalUsers}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 16 }}>Deletion requests (all time)</h3>
        <div className="stat" style={{ fontSize: 24, marginTop: 8 }}>{totalDeletions ?? 0}</div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 16 }}>Recent paying subscriptions</h3>
        <table className="table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>User</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Period end</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((r, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 12 }}>{r.user_id.slice(0, 8)}</td>
                <td>{r.plan}</td>
                <td><span className="badge badge-lime">{r.status}</span></td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <OwnerConnectors />

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 16 }}>Recent feedback</h3>
        {(!recentFeedback || recentFeedback.length === 0) && (
          <p className="dim" style={{ fontSize: 13, marginTop: 8 }}>No feedback submitted yet.</p>
        )}
        {recentFeedback && recentFeedback.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {recentFeedback.map((fb) => (
              <div
                key={fb.id}
                className="card"
                style={{ padding: 14, background: "var(--s1)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--t3)" }}>
                    {fb.user_id ? fb.user_id.slice(0, 8) : "guest"}
                  </span>
                  {fb.page && (
                    <span className="badge" style={{ fontSize: 10 }}>{fb.page}</span>
                  )}
                  <span className="mono" style={{ fontSize: 10, color: "var(--t4)", marginLeft: "auto" }}>
                    {new Date(fb.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>{fb.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
