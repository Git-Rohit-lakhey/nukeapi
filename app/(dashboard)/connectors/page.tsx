"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/db/browser";
import { ALL_CONNECTOR_META, type ConnectorMeta } from "@/lib/connectors/meta";
import { getMaxIntegrations } from "@/lib/constants/compliance";
import { CustomConnectors } from "@/components/dashboard/CustomConnectors";
import type { Integration } from "@/types/connector";

interface MineIntegration {
  key: string;
  label: string;
  category: string;
  enabled: boolean;
  hidden: boolean;
  maintenance: boolean;
  custom: boolean;
  planAllowed: boolean;
  connected: boolean;
}

export default function ConnectorsPage() {
  const [connected, setConnected] = useState<string[]>([]);
  const [active, setActive] = useState<string>("stripe");
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Per-user merged catalog from /api/connectors/mine.
  const [mine, setMine] = useState<MineIntegration[]>([]);
  const [mineMap, setMineMap] = useState<Map<string, MineIntegration>>(new Map());
  const [plan, setPlan] = useState<string>("free");
  const maxInt = getMaxIntegrations(plan);

  async function refreshConnected() {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("connector_credentials")
      .select("integration")
      .eq("is_active", true);
    setConnected((data ?? []).map((d: { integration: string }) => d.integration));
  }

  useEffect(() => {
    refreshConnected();
    fetch("/api/connectors/mine")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.data.integrations)) {
          const list = d.data.integrations as MineIntegration[];
          setMine(list);
          setMineMap(new Map(list.map((i) => [i.key, i])));
          if (d.data.plan) setPlan(d.data.plan);
        }
      })
      .catch(() => {
        /* keep empty */
      });
  }, []);

  const liveDefs = useMemo(
    () =>
      ALL_CONNECTOR_META.filter((m) => {
        const it = mineMap.get(m.key);
        if (!it) return false;
        return (it.enabled && !it.maintenance && it.planAllowed) || it.custom;
      }),
    [mineMap],
  );

  const maintDefs = useMemo(
    () =>
      ALL_CONNECTOR_META.filter((m) => {
        const it = mineMap.get(m.key);
        return !!it && it.enabled && it.maintenance;
      }),
    [mineMap],
  );

  // Keep `active` pointing at a connectable connector.
  useEffect(() => {
    if (!liveDefs.some((i) => i.key === active)) {
      const first = liveDefs[0];
      if (first) setActive(first.key);
    }
  }, [liveDefs, active]);

  function allowedForPlan(key: string): boolean {
    const it = mineMap.get(key);
    return it ? it.custom || it.planAllowed : false;
  }
  function atCap(key: string): boolean {
    const it = mineMap.get(key);
    if (it?.custom) return false; // custom grant bypasses the connection cap
    return (
      maxInt !== Infinity &&
      !connected.includes(key) &&
      connected.length >= maxInt
    );
  }

  function setField(integration: string, name: string, value: string) {
    setValues((v) => ({ ...v, [integration]: { ...(v[integration] ?? {}), [name]: value } }));
  }

  async function save(integration: string) {
    setFlash(null);
    if (!allowedForPlan(integration)) {
      setFlash({ ok: false, msg: `The "${integration}" integration is not available on your ${plan} plan.` });
      return;
    }
    if (atCap(integration)) {
      setFlash({
        ok: false,
        msg: `Your ${plan} plan allows up to ${maxInt} connected integrations. Remove one to add another.`,
      });
      return;
    }
    setSaving(true);
    const credentials = values[integration] ?? {};
    const res = await fetch("/api/v1/connectors/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integration, credentials }),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok || !json.success) {
      setFlash({ ok: false, msg: json?.error?.message ?? "Save failed" });
      return;
    }
    setFlash({ ok: true, msg: `${integration} credentials saved (encrypted at rest).` });
    setValues((v) => ({ ...v, [integration]: {} }));
    await refreshConnected();
  }

  const def: ConnectorMeta | undefined = liveDefs.find((i) => i.key === active) ?? liveDefs[0];
  const activeMine = def ? mineMap.get(def.key) : undefined;
  const capText =
    maxInt === Infinity
      ? `Connected ${connected.length} integrations (unlimited on your plan)`
      : `Connected ${connected.length} / ${maxInt} integrations on your ${plan} plan`;

  return (
    <div>
      <p className="eyebrow">connectors</p>
      <h1 style={{ fontSize: 30 }}>Connect your tools</h1>
      <p style={{ maxWidth: 620 }}>
        Credentials are encrypted with AES-256-GCM on our servers before they are
        ever written to the database. They never reach the browser in plaintext.
      </p>
      <p className="dim" style={{ fontSize: 13, marginTop: 4 }}>{capText}</p>

      <div className="flex gap-16 wrap" style={{ marginTop: 20, alignItems: "flex-start" }}>
        <div className="card" style={{ width: 220, padding: 12 }}>
          {liveDefs.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--t3)", padding: 8 }}>
              No connectors are available for your account right now.
            </div>
          )}
          {liveDefs.map((i) => (
            <button
              key={i.key}
              onClick={() => setActive(i.key)}
              className="btn"
              style={{
                width: "100%",
                justifyContent: "space-between",
                marginBottom: 6,
                background: active === i.key ? "var(--lime-10)" : "transparent",
                borderColor: active === i.key ? "var(--lime-28)" : "var(--b1)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {i.label}
                {mineMap.get(i.key)?.custom && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(139,126,255,0.14)",
                      color: "var(--violet)",
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    custom
                  </span>
                )}
              </span>
              {connected.includes(i.key) && (
                <span style={{ color: "var(--emerald)", fontSize: 12 }}>●</span>
              )}
            </button>
          ))}
        </div>

        <div className="card grow" style={{ minWidth: 320 }}>
          {def ? (
            <>
              <h3 style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 10 }}>
                {def.label}
                {activeMine?.custom && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: "rgba(139,126,255,0.14)",
                      color: "var(--violet)",
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    custom · enterprise grant
                  </span>
                )}
              </h3>
              {def.note && <p style={{ fontSize: 13 }}>{def.note}</p>}
              {flash && (
                <div className={flash.ok ? "flash flash-ok" : "flash flash-error"} style={{ marginTop: 12 }}>
                  {flash.msg}
                </div>
              )}
              {def.fields.map((f) => (
                <div key={f.name} style={{ marginTop: 12 }}>
                  <label className="label">{f.label}</label>
                  <input
                    className="input"
                    type={f.secret ? "password" : "text"}
                    placeholder={f.placeholder}
                    value={values[def.key]?.[f.name] ?? ""}
                    onChange={(e) => setField(def.key, f.name, e.target.value)}
                  />
                </div>
              ))}
              <button
                className="btn btn-primary"
                style={{ marginTop: 18 }}
                disabled={saving || !allowedForPlan(def.key) || atCap(def.key)}
                onClick={() => save(def.key)}
              >
                {saving
                  ? "Saving…"
                  : connected.includes(def.key)
                    ? "Update credentials"
                    : "Save credentials"}
              </button>
              {!allowedForPlan(def.key) && (
                <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>
                  Not available on your {plan} plan.
                </p>
              )}
              {atCap(def.key) && allowedForPlan(def.key) && (
                <p className="dim" style={{ fontSize: 12, marginTop: 10, color: "var(--amber)" }}>
                  Plan limit reached ({maxInt} integrations).
                </p>
              )}
            </>
          ) : (
            <p style={{ color: "var(--t3)" }}>Select a connector to manage its credentials.</p>
          )}
        </div>
      </div>

      {maintDefs.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>In maintenance</p>
          <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 14 }}>
            These connectors are temporarily down for maintenance by the administrator
            and cannot be connected or run right now.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {maintDefs.map((m) => (
              <span
                key={m.key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--void)",
                  border: "1px solid var(--b1)",
                  borderRadius: 100,
                  padding: "8px 14px",
                  fontSize: 14,
                  color: "var(--t3)",
                }}
              >
                <span style={{ color: "var(--t4)" }}>{m.label}</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: "rgba(245,166,35,0.12)",
                    color: "var(--amber)",
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                  }}
                >
                  maint
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Custom connectors (Business+) */}
      <CustomConnectors plan={plan} />
    </div>
  );
}
