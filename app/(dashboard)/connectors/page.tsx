"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/db/browser";
import { CONNECTOR_META } from "@/lib/connectors/meta";
import type { Integration } from "@/types/connector";

export default function ConnectorsPage() {
  const [connected, setConnected] = useState<string[]>([]);
  const [active, setActive] = useState<Integration>("stripe");
  const [values, setValues] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const meta = CONNECTOR_META[active];
  const isConnected = connected.includes(active);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.from("connector_credentials").select("integration").eq("is_active", true);
      if (data) setConnected((data as { integration: string }[]).map((r) => r.integration));
    })();
  }, []);

  useEffect(() => {
    setValues({});
    setFlash(null);
  }, [active]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFlash(null);
    const res = await fetch("/api/v1/connectors/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integration: active, credentials: values }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setFlash({ ok: true, msg: `${meta.label} credentials saved (AES-256 encrypted).` });
      setConnected((c) => (c.includes(active) ? c : [...c, active]));
    } else {
      setFlash({ ok: false, msg: json.error?.message ?? "Save failed" });
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Connectors</h1>
      <p className="muted" style={{ marginBottom: 20 }}>Connect Stripe, Mailchimp etc. Credentials are encrypted server-side (AES-256-GCM) — never plaintext.</p>
      {flash && <div className={flash.ok ? "flash flash-ok" : "flash flash-error"}>{flash.msg}</div>}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        {(Object.values(CONNECTOR_META) as typeof meta[]).map((m) => (
          <button
            key={m.key}
            onClick={() => setActive(m.key)}
            className={active === m.key ? "btn btn-primary" : "btn"}
            style={{ position: "relative" }}
          >
            {m.label} {connected.includes(m.key) && "✓"} <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 6 }}>{m.tag}</span>
          </button>
        ))}
      </div>
      <form onSubmit={handleSave} className="card">
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>{meta.label} {isConnected && <span className="badge badge-lime">connected</span>}</h3>
        <p className="dim" style={{ fontSize: 13, marginBottom: 16 }}>{meta.note ?? `Enter your ${meta.label} credentials.`}</p>
        {meta.fields.map((f) => (
          <div key={f.name} style={{ marginBottom: 12 }}>
            <label className="label">{f.label}</label>
            <input
              className="input"
              type={f.secret ? "password" : "text"}
              placeholder={f.placeholder}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              required={meta.required.includes(f.name)}
            />
          </div>
        ))}
        <button className="btn btn-primary" disabled={saving} style={{ marginTop: 8 }}>{saving ? "Saving…" : isConnected ? "Update" : "Connect"}</button>
        <span style={{ fontSize: 12, color: "var(--t3)", marginLeft: 12 }}>Free plan: up to 3 integrations (stripe/mailchimp/hubspot)</span>
      </form>
    </div>
  );
}
