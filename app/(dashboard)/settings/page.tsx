"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/db/browser";
import { PLANS } from "@/lib/constants/compliance";
import PricingGrid from "@/components/marketing/PricingGrid";

interface SubRow {
  plan: string;
  status: string;
  external_subscription_id: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
}

export default function SettingsPage() {
  const [sub, setSub] = useState<SubRow | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("subscriptions").select("plan,status,external_subscription_id,current_period_end,trial_ends_at").eq("user_id", user.id).maybeSingle();
      if (data) setSub(data as SubRow);
      const { data: meter } = await supabase.from("usage_meters").select("deletion_count").eq("user_id", user.id).order("period_start", { ascending: false }).limit(1).maybeSingle();
      if (meter) {
        const plan = (data as SubRow)?.plan ?? "free";
        const def = PLANS[plan as keyof typeof PLANS] ?? PLANS.free;
        setUsage({ used: (meter as { deletion_count: number }).deletion_count, limit: def.includedDeletions });
      } else {
        const plan = (data as SubRow)?.plan ?? "free";
        const def = PLANS[plan as keyof typeof PLANS] ?? PLANS.free;
        setUsage({ used: 0, limit: def.includedDeletions });
      }
    })();
  }, []);

  async function handleSelect(plan: string, billing: "monthly" | "yearly") {
    setCheckoutBusy(plan);
    setFlash(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing }),
      });
      const json = await res.json();
      if (json.success && json.data?.checkoutUrl) {
        window.location.assign(json.data.checkoutUrl);
      } else {
        setFlash({ ok: false, msg: json.error?.message ?? "Checkout failed" });
        setCheckoutBusy(null);
      }
    } catch (e) {
      setFlash({ ok: false, msg: (e as Error).message });
      setCheckoutBusy(null);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel your subscription? It will remain active until the end of the billing period.")) return;
    setBusy(true);
    setFlash(null);
    const res = await fetch("/api/v1/subscription/cancel", { method: "POST" });
    const json = await res.json();
    setBusy(false);
    if (json.success) {
      setFlash({ ok: true, msg: "Subscription cancelled. It remains active until period end." });
      setSub((s) => s ? { ...s, status: "cancelled" } : s);
    } else {
      setFlash({ ok: false, msg: json.error?.message ?? "Cancel failed" });
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("Delete your entire account and all data? This cannot be undone.")) return;
    const res = await fetch("/api/v1/account/delete", { method: "POST" });
    const json = await res.json();
    if (json.success) {
      window.location.assign("/signup");
    } else {
      setFlash({ ok: false, msg: json.error?.message ?? "Delete failed" });
    }
  }

  const currentPlan = sub?.plan ?? "free";
  const isPaid = currentPlan !== "free" && sub?.status === "active";
  const trialDays =
    sub?.status === "trialing" && sub?.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
      : 0;

  const pct = !usage ? 0 : usage.limit === Infinity ? 100 : usage.limit === 0 ? 0 : Math.min(100, Math.round((usage.used / usage.limit) * 100));

  return (
    <div className="anim-fadeUp">
      <p className="eyebrow">settings · billing</p>
      <h1 style={{ fontSize: 30, marginBottom: 6 }}>Settings & billing</h1>
      <p className="muted" style={{ marginBottom: 22, fontSize: 13.5 }}>Manage your plan, usage and account. <span className="badge badge-lime" style={{ verticalAlign: "middle" }}><span className="dot" />test mode</span> <span style={{ color: "var(--t3)" }}>· use Dodo test card 4242 4242 4242 4242</span></p>
      {flash && <div className={flash.ok ? "flash flash-ok" : "flash flash-error"}>{flash.msg}</div>}
      {sub?.status === "trialing" && sub?.trial_ends_at && (
        <div className="flash flash-ok">
          Trial active — {trialDays} {trialDays === 1 ? "day" : "days"} remaining on {PLANS[currentPlan as keyof typeof PLANS]?.label ?? currentPlan}. No card required.
        </div>
      )}

      <div className="card card-hover" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontSize: 15, margin: 0 }}>💳 Current plan</h3>
          {sub?.current_period_end && <div style={{ fontSize: 12, color: "var(--t3)" }}>Renews {new Date(sub.current_period_end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
          <span className="badge badge-lime" style={{ fontSize: 13.5, padding: "6px 14px" }}><span className="dot" />{PLANS[currentPlan as keyof typeof PLANS]?.label ?? currentPlan}</span>
          {sub?.status && <span className="badge" style={{ textTransform: "capitalize" }}>{sub.status}</span>}
        </div>
        {usage && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--t2)", marginBottom: 6 }}>
              <span>Usage this period</span>
              <span className="mono">{usage.used} / {usage.limit === Infinity ? "∞" : usage.limit}</span>
            </div>
            <div className="progress"><span style={{ width: `${pct}%` }} /></div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>🚀 Upgrade or change plan</h3>
        <p className="dim" style={{ fontSize: 12.5, marginBottom: 16 }}>Secure checkout via Dodo Payments. Your plan upgrades automatically the moment payment confirms.</p>
        {checkoutBusy && <div className="flash flash-ok">Redirecting to Dodo checkout…</div>}
        <PricingGrid mode="billing" currentPlan={currentPlan} onSelect={handleSelect} />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Subscription</h3>
          <p className="dim" style={{ fontSize: 12.5, marginBottom: 12 }}>Cancel calls Dodo first, then updates locally — you&apos;re never charged after cancelling.</p>
          <button className="btn" onClick={handleCancel} disabled={busy || !isPaid}>{busy ? "Cancelling…" : "Cancel subscription"}</button>
          {!isPaid && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 8 }}>No active paid subscription to cancel.</div>}
        </div>
        <div className="card" style={{ borderColor: "rgba(255,80,80,.2)" }}>
          <h3 style={{ fontSize: 15, marginBottom: 8, color: "var(--rose)" }}>⛔ Danger zone</h3>
          <p className="dim" style={{ fontSize: 12.5, marginBottom: 12 }}>Deletes your account, keys, credentials and history. Cannot be undone.</p>
          <button className="btn btn-danger" onClick={handleDeleteAccount}>Delete account</button>
        </div>
      </div>
    </div>
  );
}
