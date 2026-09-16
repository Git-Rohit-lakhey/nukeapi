"use client";

import { useState, useEffect } from "react";

interface CustomConnector {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

interface Props {
  plan: string;
}

export function CustomConnectors({ plan }: Props) {
  const [connectors, setConnectors] = useState<CustomConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState<"none" | "bearer" | "basic" | "header">("bearer");
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [headerName, setHeaderName] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [findPath, setFindPath] = useState("");
  const [findMethod, setFindMethod] = useState<"GET" | "POST">("GET");
  const [findResultsPath, setFindResultsPath] = useState("data");
  const [findIdPath, setFindIdPath] = useState("id");
  const [deletePath, setDeletePath] = useState("");
  const [deleteMethod, setDeleteMethod] = useState<"DELETE" | "POST">("DELETE");
  const [credFields, setCredFields] = useState("access_token");
  const [credValues, setCredValues] = useState("");

  const isBusinessPlus = ["business", "business_yearly", "enterprise", "enterprise_yearly"].includes(plan);

  async function loadConnectors() {
    try {
      const res = await fetch("/api/v1/connectors/custom");
      const json = await res.json();
      if (json.success) setConnectors(json.data ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { loadConnectors(); }, []);

  async function handleCreate() {
    setFlash(null);
    setSaving(true);

    // Build the spec from form fields
    const auth: Record<string, unknown> = { type: authType };
    if (authType === "bearer") auth.token = `{cred.${credFields.split(",")[0]?.trim() ?? "access_token"}}`;
    if (authType === "basic") { auth.user = `{cred.${credFields.split(",")[0]?.trim() ?? "username"}}`; auth.pass = `{cred.${credFields.split(",")[1]?.trim() ?? "password"}}`; }
    if (authType === "header") { auth.name = headerName; auth.value = `{cred.${credFields.split(",")[0]?.trim() ?? "token"}}`; }

    const spec = {
      transport: "http",
      label: name,
      baseUrl,
      auth,
      find: { method: findMethod, path: findPath, resultsPath: findResultsPath, idPath: findIdPath },
      delete: { method: deleteMethod, path: deletePath, itemNoun: "record" },
      credentialFields: credFields.split(",").map((s) => s.trim()).filter(Boolean),
    };

    // Build credentials object
    const credEntries = credFields.split(",").map((s) => s.trim()).filter(Boolean);
    const credValEntries = credValues.split(",").map((s) => s.trim());
    const credentials: Record<string, string> = {};
    credEntries.forEach((k, i) => { credentials[k] = credValEntries[i] ?? ""; });

    const res = await fetch("/api/v1/connectors/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, spec, credentials }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok || !json.success) {
      setFlash({ ok: false, msg: json?.error?.message ?? "Failed to create connector" });
      return;
    }
    setFlash({ ok: true, msg: `Connector "${name}" created. Use slug: custom_${json.data.slug}` });
    setShowForm(false);
    resetForm();
    await loadConnectors();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/v1/connectors/custom/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setFlash({ ok: false, msg: json?.error?.message ?? "Failed to delete" });
      return;
    }
    setFlash({ ok: true, msg: `"${name}" deleted.` });
    await loadConnectors();
  }

  function resetForm() {
    setName(""); setBaseUrl(""); setAuthType("bearer"); setAuthToken("");
    setAuthUser(""); setAuthPass(""); setHeaderName(""); setHeaderValue("");
    setFindPath(""); setFindMethod("GET"); setFindResultsPath("data"); setFindIdPath("id");
    setDeletePath(""); setDeleteMethod("DELETE"); setCredFields("access_token"); setCredValues("");
  }

  if (!isBusinessPlus) {
    return (
      <div className="card" style={{ marginTop: 16, borderColor: "var(--b2)" }}>
        <h3 style={{ fontSize: 16 }}>Custom Connectors</h3>
        <p className="dim" style={{ fontSize: 13, marginTop: 4 }}>
          Define your own HTTP integrations to delete users from any REST API.
          Available on the Business plan and above.
        </p>
        <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--s2)", borderRadius: 8, fontSize: 13, color: "var(--t3)" }}>
          Upgrade to Business to unlock custom connectors.
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="flex between items-center">
        <div>
          <h3 style={{ fontSize: 16 }}>Custom Connectors</h3>
          <p className="dim" style={{ fontSize: 13, marginTop: 4 }}>
            Define your own HTTP integrations to delete users from any REST API.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New connector"}
        </button>
      </div>

      {flash && (
        <div className={flash.ok ? "flash flash-ok" : "flash flash-error"} style={{ marginTop: 12 }}>
          {flash.msg}
        </div>
      )}

      {/* Existing connectors */}
      {connectors.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {connectors.map((c) => (
            <div key={c.id} className="flex between items-center" style={{ padding: "10px 14px", background: "var(--s2)", borderRadius: 8 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                <code style={{ marginLeft: 8, fontSize: 12, color: "var(--t3)" }}>custom_{c.slug}</code>
                {!c.is_active && <span className="badge" style={{ marginLeft: 8, fontSize: 11 }}>disabled</span>}
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id, c.name)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {connectors.length === 0 && !showForm && !loading && (
        <p className="dim" style={{ fontSize: 13, marginTop: 12 }}>No custom connectors yet.</p>
      )}

      {/* Create form */}
      {showForm && (
        <div style={{ marginTop: 16, padding: 20, background: "var(--s2)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="label">Connector name</label>
            <input className="input" placeholder="My Internal API" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Base URL</label>
            <input className="input" placeholder="https://api.example.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Auth type</label>
              <select className="input" value={authType} onChange={(e) => setAuthType(e.target.value as typeof authType)}>
                <option value="bearer">Bearer token</option>
                <option value="basic">Basic auth</option>
                <option value="header">Custom header</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="label">Credential fields <span className="dim">(comma-separated)</span></label>
              <input className="input" placeholder="access_token" value={credFields} onChange={(e) => setCredFields(e.target.value)} />
            </div>
          </div>
          {authType === "header" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">Header name</label>
                <input className="input" placeholder="X-API-Key" value={headerName} onChange={(e) => setHeaderName(e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <label className="label">Credential values <span className="dim">(comma-separated, same order as fields)</span></label>
            <input className="input" type="password" placeholder="sk_live_abc123" value={credValues} onChange={(e) => setCredValues(e.target.value)} />
          </div>
          <div style={{ borderTop: "1px solid var(--b1)", paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)", marginBottom: 10 }}>Find step (search by email)</div>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr", gap: 10 }}>
              <select className="input" value={findMethod} onChange={(e) => setFindMethod(e.target.value as "GET" | "POST")}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
              <input className="input" placeholder="/users?email={email}" value={findPath} onChange={(e) => setFindPath(e.target.value)} />
              <input className="input" placeholder="results path (data)" value={findResultsPath} onChange={(e) => setFindResultsPath(e.target.value)} />
              <input className="input" placeholder="id path (id)" value={findIdPath} onChange={(e) => setFindIdPath(e.target.value)} />
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--b1)", paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)", marginBottom: 10 }}>Delete step</div>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10 }}>
              <select className="input" value={deleteMethod} onChange={(e) => setDeleteMethod(e.target.value as "DELETE" | "POST")}>
                <option value="DELETE">DELETE</option>
                <option value="POST">POST</option>
              </select>
              <input className="input" placeholder="/users/{res.id}" value={deletePath} onChange={(e) => setDeletePath(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? "Creating…" : "Create connector"}
          </button>
        </div>
      )}
    </div>
  );
}
