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
      const { data } = await supabase.from("subscriptions").select("plan,status,external_subscription_id,current_period_end").eq("user_id", user.id).maybeSingle();
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

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Settings & billing</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Manage your plan, usage and account. Test mode — use Dodo test card 4242 4242 4242 4242.</p>
      {flash && <div className={flash.ok ? "flash flash-ok" : "flash flash-error"}>{flash.msg}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Current plan</h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span className="badge badge-lime" style={{ fontSize: 14, padding: "6px 14px" }}>{PLANS[currentPlan as keyof typeof PLANS]?.label ?? currentPlan}</span>
          {sub?.status && <span className="badge" style={{ textTransform: "capitalize" }}>{sub.status}</span>}
          {usage && <span style={{ fontSize: 13, color: "var(--t2)" }}>{usage.used} / {usage.limit === Infinity ? "∞" : usage.limit} deletions this period</span>}
        </div>
        {sub?.current_period_end && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 8 }}>Renews: {new Date(sub.current_period_end).toLocaleDateString()}</div>}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>Upgrade or change plan</h3>
        <p className="dim" style={{ fontSize: 13, marginBottom: 16 }}>Checkout is via Dodo Payments (test_mode). Webhook upgrades your plan automatically.</p>
        {checkoutBusy && <div className="flash flash-ok">Redirecting to checkout…</div>}
        <PricingGrid mode="billing" currentPlan={currentPlan} onSelect={handleSelect} />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Subscription actions</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn" onClick={handleCancel} disabled={busy || !isPaid}>{busy ? "Cancelling…" : "Cancel subscription"}</button>
          <span style={{ fontSize: 12, color: "var(--t3)", alignSelf: "center" }}>{!isPaid ? "No active paid subscription to cancel" : "Calls Dodo PATCH /subscriptions/{id} first (§6.12)"}</span>
        </div>
      </div>

      <div className="card" style={{ borderColor: "var(--rose-10)" }}>
        <h3 style={{ fontSize: 16, marginBottom: 8, color: "var(--rose)" }}>Danger zone</h3>
        <button className="btn" style={{ borderColor: "var(--rose)", color: "var(--rose)" }} onClick={handleDeleteAccount}>Delete account</button>
        <span style={{ fontSize: 12, color: "var(--t3)", marginLeft: 12 }}>Cascades to all keys/credentials/requests</span>
      </div>
    </div>
  );
}
