"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

interface NotifState {
  settings: {
    webhook_url: string | null;
    slack_webhook_url: string | null;
    email_alerts: boolean;
  };
  capabilities: { webhook: boolean; slack: boolean; email: boolean };
}

export default function SettingsPage() {
  const [sub, setSub] = useState<SubRow | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState<NotifState | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [notifBusy, setNotifBusy] = useState(false);
  const [sso, setSso] = useState<{
    configured: boolean;
    config: { idp_entity_id: string | null; domain: string | null; is_active: boolean } | null;
  } | null>(null);
  const [ssoForm, setSsoForm] = useState({
    idp_entity_id: "",
    sso_login_url: "",
    x509_cert: "",
    domain: "",
  });
  const [ssoBusy, setSsoBusy] = useState(false);
  const [ssoMsg, setSsoMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subRef = useRef<SubRow | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("subscriptions")
      .select("plan,status,external_subscription_id,current_period_end,trial_ends_at")
      .maybeSingle();
    const row = (data as SubRow) ?? null;
    subRef.current = row;
    setSub(row);
  }, []);

  async function loadNotif() {
    try {
      const res = await fetch("/api/v1/webhook");
      const json = await res.json();
      if (res.ok && json.success) {
        const n = json.data as NotifState;
        setNotif(n);
        setWebhookUrl(n.settings.webhook_url ?? "");
        setSlackUrl(n.settings.slack_webhook_url ?? "");
        setEmailAlerts(n.settings.email_alerts ?? true);
      }
    } catch {
      /* ignore */
    }
  }

  async function loadSso() {
    try {
      const res = await fetch("/api/sso/config");
      const json = await res.json();
      if (res.ok && json.success) {
        setSso(json.data);
        if (json.data?.config) {
          setSsoForm({
            idp_entity_id: json.data.config.idp_entity_id ?? "",
            sso_login_url: "",
            x509_cert: "",
            domain: json.data.config.domain ?? "",
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    loadNotif();
    loadSso();

    // After checkout redirect, poll for webhook updates for up to 30 seconds
    const url = new URL(window.location.href);
    const fromCheckout = url.searchParams.get("checkout") === "success";
    if (fromCheckout) {
      setFlash({ ok: true, msg: "Payment received. Waiting for subscription to activate…" });
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        await load();
        const current = subRef.current;
        if ((current && current.plan !== "free") || attempts >= 15) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (current && current.plan !== "free") {
            setFlash({ ok: true, msg: "Subscription activated!" });
            setTimeout(() => setFlash(null), 3000);
          } else if (attempts >= 15) {
            setFlash({ ok: false, msg: "Subscription may still be processing. Refresh in a moment." });
          }
        }
      }, 2000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSso() {
    setSsoMsg(null);
    setSsoBusy(true);
    const res = await fetch("/api/sso/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ssoForm),
    });
    setSsoBusy(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      setSsoMsg({ ok: false, msg: json?.error?.message ?? "Failed to save SSO config" });
      return;
    }
    setSsoMsg({ ok: true, msg: "SSO configuration saved." });
    await loadSso();
  }

  async function removeSso() {
    if (!confirm("Remove your SAML SSO configuration?")) return;
    setSsoBusy(true);
    const res = await fetch("/api/sso/config", { method: "DELETE" });
    setSsoBusy(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      setSsoMsg({ ok: false, msg: json?.error?.message ?? "Failed to remove SSO config" });
      return;
    }
    setSsoMsg({ ok: true, msg: "SSO configuration removed." });
    setSsoForm({ idp_entity_id: "", sso_login_url: "", x509_cert: "", domain: "" });
    await loadSso();
  }

  async function saveNotif() {
    setFlash(null);
    setNotifBusy(true);
    const payload: Record<string, unknown> = {};
    if (notif?.capabilities.webhook) payload.webhook_url = webhookUrl.trim() || null;
    if (notif?.capabilities.slack) payload.slack_webhook_url = slackUrl.trim() || null;
    if (notif?.capabilities.email) payload.email_alerts = emailAlerts;
    const res = await fetch("/api/v1/webhook", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setNotifBusy(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      setFlash({ ok: false, msg: json?.error?.message ?? "Failed to save notifications" });
      return;
    }
    setFlash({ ok: true, msg: "Notification settings saved." });
    await loadNotif();
  }

  async function upgrade(plan: string, billing: string) {
    setFlash(null);
    setBusy(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, billing }),
    });
    setBusy(false);
    const json = await res.json();
    if (!res.ok || !json.success) {
      setFlash({ ok: false, msg: json?.error?.message ?? "Checkout failed" });
      return;
    }
    window.location.href = json.data.checkoutUrl;
  }

  async function cancel() {
    if (!confirm("Cancel your subscription? You'll keep access until the period ends.")) return;
    setBusy(true);
    const res = await fetch("/api/v1/subscription/cancel", { method: "POST" });
    setBusy(false);
    const json = await res.json();
    if (!res.ok || !json.success) {
      setFlash({ ok: false, msg: json?.error?.message ?? "Cancel failed" });
      return;
    }
    setFlash({ ok: true, msg: "Subscription cancelled at provider." });
    await load();
  }

  async function deleteAccount() {
    if (!confirm("Permanently delete your account and ALL data? This cannot be undone.")) return;
    setBusy(true);
    const res = await fetch("/api/v1/account/delete", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      window.location.href = "/";
    } else {
      const json = await res.json().catch(() => ({}));
      setFlash({ ok: false, msg: json?.error?.message ?? "Delete failed" });
    }
  }

  const plan = sub?.plan ?? "free";

  return (
    <div>
      <p className="eyebrow">settings</p>
      <h1 style={{ fontSize: 30 }}>Plan & billing</h1>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="flex between items-center">
          <div>
            <div className="dim" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>CURRENT PLAN</div>
            <h3 style={{ fontSize: 22, margin: "4px 0" }}>
              {PLANS[plan as keyof typeof PLANS]?.label ?? plan}
            </h3>
            {sub?.status === "trialing" ? (
              <span className="badge" style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
                TRIAL{sub?.trial_ends_at
                  ? ` · ${Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days left`
                  : ""}
              </span>
            ) : sub?.status === "cancelled" ? (
              <span className="badge badge-failed">CANCELLED</span>
            ) : plan !== "free" ? (
              <span className="badge badge-lime">{sub?.status ?? "active"}</span>
            ) : (
              <span className="badge" style={{ color: "var(--t3)" }}>FREE</span>
            )}
          </div>
          {plan !== "free" && sub?.status !== "cancelled" && (
            <button className="btn btn-danger" disabled={busy} onClick={cancel}>
              Cancel subscription
            </button>
          )}
        </div>
        {sub?.status === "trialing" && sub?.trial_ends_at && (
          <p className="dim" style={{ fontSize: 13, marginTop: 8 }}>
            Your trial ends on {new Date(sub.trial_ends_at).toLocaleDateString()}. Upgrade anytime to keep access.
          </p>
        )}
        {sub?.current_period_end && sub?.status !== "trialing" && (
          <p className="dim" style={{ fontSize: 13, marginTop: 8 }}>
            Period ends {new Date(sub.current_period_end).toLocaleDateString()}
          </p>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        {flash && (
          <div className={flash.ok ? "flash flash-ok" : "flash flash-error"} style={{ marginBottom: 12 }}>
            {flash.msg}
          </div>
        )}
        <PricingGrid mode="billing" currentPlan={plan} onSelect={upgrade} />
      </div>

      {notif && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 16 }}>Completion notifications</h3>
          <p className="dim" style={{ fontSize: 13, marginTop: 4 }}>
            Get notified when a deletion request finishes. Available channels
            depend on your plan.
          </p>

          {/* Webhook — Startup+ */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Webhook URL{" "}
              <span className="dim" style={{ fontWeight: 400 }}>
                (Startup and above)
              </span>
            </label>
            {notif.capabilities.webhook ? (
              <input
                className="input"
                style={{ width: "100%", marginTop: 6 }}
                placeholder="https://your-app.com/hooks/nukeapi"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            ) : (
              <p className="dim" style={{ fontSize: 12, marginTop: 6 }}>
                Upgrade to Startup to POST each deletion result to your endpoint
                (signed with <code>X-NukeAPI-Signature</code>).
              </p>
            )}
          </div>

          {/* Slack — Business+ */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Slack incoming webhook{" "}
              <span className="dim" style={{ fontWeight: 400 }}>
                (Business and above)
              </span>
            </label>
            {notif.capabilities.slack ? (
              <input
                className="input"
                style={{ width: "100%", marginTop: 6 }}
                placeholder="https://hooks.slack.com/services/…"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
              />
            ) : (
              <p className="dim" style={{ fontSize: 12, marginTop: 6 }}>
                Upgrade to Business for Slack alerts on every deletion.
              </p>
            )}
          </div>

          {/* Email alerts — Business+ */}
          {notif.capabilities.email && (
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <input
                id="email_alerts"
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
              />
              <label htmlFor="email_alerts" style={{ fontSize: 13 }}>
                Email me a summary of every completed deletion
              </label>
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <button className="btn btn-primary" disabled={notifBusy} onClick={saveNotif}>
              {notifBusy ? "Saving…" : "Save notifications"}
            </button>
          </div>
        </div>
      )}

      {(plan === "enterprise" || plan === "enterprise_yearly") && (
        <div className="card" style={{ marginTop: 16, borderColor: "var(--violet-10, rgba(168,85,247,.4))" }}>
          <h3 style={{ fontSize: 16 }}>SSO / SAML</h3>
          <p className="dim" style={{ fontSize: 13, marginTop: 4 }}>
            Let your team sign in through your identity provider (Okta, Entra ID,
            Google Workspace, …). Provide your IdP metadata below, then give your
            IdP this SP metadata:{" "}
            <a href="/api/sso/metadata" className="mono" style={{ color: "var(--lime)" }}>
              /api/sso/metadata
            </a>
            .
          </p>

          {ssoMsg && (
            <div className={ssoMsg.ok ? "flash flash-ok" : "flash flash-error"} style={{ marginTop: 14 }}>
              {ssoMsg.msg}
            </div>
          )}

          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>IdP Entity ID</label>
              <input
                className="input"
                style={{ width: "100%", marginTop: 6 }}
                placeholder="https://your-idp/entity-id"
                value={ssoForm.idp_entity_id}
                onChange={(e) => setSsoForm({ ...ssoForm, idp_entity_id: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>IdP SSO login URL</label>
              <input
                className="input"
                style={{ width: "100%", marginTop: 6 }}
                placeholder="https://your-idp/sso"
                value={ssoForm.sso_login_url}
                onChange={(e) => setSsoForm({ ...ssoForm, sso_login_url: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>X.509 signing certificate (PEM)</label>
              <textarea
                className="input"
                style={{ width: "100%", marginTop: 6, minHeight: 96, fontFamily: "var(--mono)", fontSize: 12 }}
                placeholder="-----BEGIN CERTIFICATE-----&#10;…&#10;-----END CERTIFICATE-----"
                value={ssoForm.x509_cert}
                onChange={(e) => setSsoForm({ ...ssoForm, x509_cert: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Email domain <span className="dim" style={{ fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                className="input"
                style={{ width: "100%", marginTop: 6 }}
                placeholder="acme.com"
                value={ssoForm.domain}
                onChange={(e) => setSsoForm({ ...ssoForm, domain: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <button className="btn btn-primary" disabled={ssoBusy} onClick={saveSso}>
              {ssoBusy ? "Saving…" : sso?.configured ? "Update SSO" : "Enable SSO"}
            </button>
            {sso?.configured && (
              <button className="btn btn-danger" disabled={ssoBusy} onClick={removeSso}>
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16, borderColor: "var(--rose-10)" }}>
        <h3 style={{ fontSize: 16, color: "var(--rose)" }}>Danger zone</h3>
        <p style={{ fontSize: 13 }}>
          Permanently delete your account. This cascades to all API keys,
          deletion requests, credentials and usage data.
        </p>
        <button className="btn btn-danger" disabled={busy} onClick={deleteAccount}>
          Delete account
        </button>
      </div>
    </div>
  );
}
