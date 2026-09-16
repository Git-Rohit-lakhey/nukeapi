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
    <div className="anim-fadeUp">
      <p className="eyebrow">connectors</p>
      <h1 style={{ fontSize: 30, marginBottom: 6 }}>Connectors</h1>
      <p className="muted" style={{ marginBottom: 20, fontSize: 13.5, maxWidth: 640 }}>Credentials are encrypted server-side (AES-256-GCM) before storage — the DB never sees plaintext, the browser never sees the key. <span style={{ color: "var(--emerald)" }}>🔒</span></p>
      {flash && <div className={flash.ok ? "flash flash-ok" : "flash flash-error"}>{flash.msg}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }} className="grid-3">
        {(Object.values(CONNECTOR_META) as typeof meta[]).map((m) => {
          const on = connected.includes(m.key);
          const sel = active === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              style={{
                textAlign: "left", cursor: "pointer", padding: 16, borderRadius: 12,
                background: sel ? "var(--lime-10)" : "var(--s1)",
                border: sel ? "1px solid var(--lime-28)" : "1px solid var(--b1)",
                transition: "all .15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: on ? "var(--em-10)" : "var(--s3)", border: on ? "1px solid rgba(34,208,122,.3)" : "1px solid var(--b2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: on ? "var(--emerald)" : "var(--t2)" }}>{m.label[0]}</div>
                {on ? <span className="badge badge-success"><span className="dot" />live</span> : <span className="badge">off</span>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 10, color: sel ? "var(--lime)" : "var(--txt)" }}>{m.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 2 }}>{m.tag} · {m.required.length} field{m.required.length === 1 ? "" : "s"}</div>
            </button>
          );
        })}
      </div>
      <form onSubmit={handleSave} className="card card-hover">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ fontSize: 15, margin: 0 }}>🔑 {meta.label} {isConnected && <span className="badge badge-success" style={{ marginLeft: 8 }}><span className="dot" />connected</span>}</h3>
          <span className="badge">{meta.tag}</span>
        </div>
        <p className="dim" style={{ fontSize: 12.5, margin: "8px 0 16px" }}>{meta.note ?? `Enter your ${meta.label} credentials. They are encrypted on the server before storage.`}</p>
        {meta.fields.map((f) => (
          <div key={f.name} style={{ marginBottom: 12 }}>
            <label className="label">{f.label} {f.secret && <span style={{ color: "var(--t3)", fontWeight: 400 }}>· stored encrypted</span>}</label>
            <input
              className="input mono"
              type={f.secret ? "password" : "text"}
              placeholder={f.placeholder}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              required={meta.required.includes(f.name)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : isConnected ? "Update credentials" : `Connect ${meta.label}`}</button>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>Free plan: stripe · mailchimp · hubspot (3 max)</span>
        </div>
      </form>
    </div>
  );
}
