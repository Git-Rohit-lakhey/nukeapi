"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/db/browser";

interface KeyRow {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("api_keys")
      .select("id,name,key_prefix,is_active,last_used_at,created_at")
      .order("created_at", { ascending: false });
    setKeys((data as KeyRow[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createKey() {
    if (!name.trim()) {
      setFlash({ ok: false, msg: "Name your key first." });
      return;
    }
    setCreating(true);
    const res = await fetch("/api/v1/keys/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    const json = await res.json();
    if (!res.ok || !json.success) {
      setFlash({ ok: false, msg: json?.error?.message ?? "Create failed" });
      return;
    }
    setRevealed(json.data.key);
    setName("");
    setFlash(null);
    await load();
  }

  async function revoke(id: string, keyName: string) {
    if (!confirm(`Revoke key "${keyName}"? This cannot be undone.`)) return;
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) {
      setFlash({ ok: false, msg: error.message });
      return;
    }
    await load();
  }

  async function copyKey() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed);
      setFlash({ ok: true, msg: "Copied to clipboard." });
    } catch {
      setFlash({ ok: false, msg: "Copy failed — select the key manually." });
    }
  }

  return (
    <div className="anim-fadeUp">
      <p className="eyebrow">api keys</p>
      <h1 style={{ fontSize: 30, marginBottom: 6 }}>API keys</h1>
      <p style={{ maxWidth: 640, fontSize: 13.5 }}>
        Authenticate deletion calls with <code className="mono" style={{ background: "var(--s3)", padding: "2px 7px", borderRadius: 6, border: "1px solid var(--b1)" }}>Authorization: Bearer nk_live_...</code>.
        The full key is shown <strong>only once</strong> at creation — store it in your secrets manager.
      </p>

      {revealed && (
        <div className="card card-featured" style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 15, color: "var(--lime)" }}>✅ Key created — copy it now</h3>
          <pre className="codeblock" style={{ marginTop: 10, borderColor: "var(--lime-18)" }}>{revealed}</pre>
          <div className="flex gap-12 wrap" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={copyKey}>Copy key</button>
            <button className="btn btn-sm" onClick={() => setRevealed(null)}>
              Done — I have stored it
            </button>
          </div>
        </div>
      )}

      {flash && (
        <div className={flash.ok ? "flash flash-ok" : "flash flash-error"} style={{ marginTop: 16 }}>
          {flash.msg}
        </div>
      )}

      <div className="card card-hover" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 15 }}>＋ Create a new key</h3>
        <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="e.g. Production server"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createKey(); }}
            style={{ maxWidth: 320, flex: "1 1 220px" }}
          />
          <button className="btn btn-primary" disabled={creating} onClick={createKey}>
            {creating ? "Creating…" : "Create key"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 15 }}>Your keys <span className="dim" style={{ fontWeight: 400, fontSize: 12 }}>({keys.length})</span></h3>
        {keys.length === 0 ? (
          <div className="empty" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>🔑</div>
            <div style={{ fontWeight: 700, color: "var(--t2)", fontSize: 13.5 }}>No keys yet</div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>Create one above, then call <span className="mono">POST /api/v1/delete-user</span>.</div>
          </div>
        ) : (
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Last used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 600 }}>{k.name}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{k.key_prefix}…</td>
                  <td>
                    {k.last_used_at
                      ? <span className="mono" style={{ fontSize: 12 }}>{new Date(k.last_used_at).toLocaleDateString()}</span>
                      : <span className="badge">never used</span>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm btn-danger" onClick={() => revoke(k.id, k.name)}>
                      Revoke
                    </button>
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
