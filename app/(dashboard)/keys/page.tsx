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

  return (
    <div>
      <p className="eyebrow">api keys</p>
      <h1 style={{ fontSize: 30 }}>API keys</h1>
      <p style={{ maxWidth: 620 }}>
        Authenticate deletion calls with <code>Authorization: Bearer nk_live_...</code>.
        The full key is shown only once at creation.
      </p>

      {revealed && (
        <div className="card" style={{ marginTop: 20, borderColor: "var(--lime-28)" }}>
          <h3 style={{ fontSize: 16, color: "var(--lime)" }}>Key created — copy it now</h3>
          <pre className="codeblock" style={{ marginTop: 8 }}>{revealed}</pre>
          <button className="btn btn-sm" onClick={() => setRevealed(null)}>
            Done — I&apos;ve copied it
          </button>
        </div>
      )}

      {flash && (
        <div className={flash.ok ? "flash flash-ok" : "flash flash-error"} style={{ marginTop: 16 }}>
          {flash.msg}
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 16 }}>Create a new key</h3>
        <div className="flex gap-12" style={{ marginTop: 10 }}>
          <input
            className="input"
            placeholder="e.g. Production server"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <button className="btn btn-primary" disabled={creating} onClick={createKey}>
            {creating ? "Creating…" : "Create key"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 16 }}>Your keys</h3>
        {keys.length === 0 ? (
          <p style={{ marginTop: 8 }}>No keys yet.</p>
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
                  <td>{k.name}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{k.key_prefix}…</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "never"}
                  </td>
                  <td>
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
