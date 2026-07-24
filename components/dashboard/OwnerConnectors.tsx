"use client";

import { useEffect, useState, useCallback } from "react";

interface ConnectorRow {
  key: string;
  label: string;
  tag: string;
  category: string;
  enabled: boolean;
  hidden: boolean;
  maintenance: boolean;
  note: string | null;
  toggledAt: string | null;
}

interface GrantRow {
  userId: string;
  integration: string;
  label: string;
  grantedBy: string | null;
  createdAt: string;
}

function ToggleSwitch({
  on,
  busy,
  label,
  onToggle,
}: {
  on: boolean;
  busy: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onToggle}
      className="btn"
      style={{
        width: 64,
        justifyContent: "space-between",
        padding: "4px 6px",
        borderRadius: 100,
        background: on ? "var(--lime-28)" : "var(--s3)",
        borderColor: on ? "var(--lime)" : "var(--b2)",
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: on ? "var(--lime)" : "var(--t3)",
          transform: on ? "translateX(28px)" : "translateX(0)",
          transition: "transform 0.15s, background 0.15s",
        }}
      />
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: on ? "var(--lime)" : "var(--t3)",
          marginLeft: -28,
          transform: on ? "translateX(28px)" : "translateX(0)",
          transition: "transform 0.15s, background 0.15s",
        }}
      />
    </button>
  );
}

export function OwnerConnectors() {
  const [rows, setRows] = useState<ConnectorRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Custom grants
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantIntegration, setGrantIntegration] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantErr, setGrantErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/admin/connectors");
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErr(json?.error?.message ?? "Failed to load connectors");
      return;
    }
    setRows(json.data.integrations);
    setLoaded(true);
  }, []);

  const loadGrants = useCallback(async () => {
    const res = await fetch("/api/admin/connectors/grants");
    const json = await res.json();
    if (res.ok && json.success) setGrants(json.data.grants);
  }, []);

  useEffect(() => {
    load();
    loadGrants();
  }, [load, loadGrants]);

  async function toggleLive(row: ConnectorRow) {
    const next = !(row.enabled && !row.hidden); // next "live" state
    setBusy(`${row.key}:live`);
    setErr(null);
    const res = await fetch("/api/admin/connectors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        integration: row.key,
        enabled: next,
        hidden: !next,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErr(json?.error?.message ?? `Failed to update ${row.label}`);
    } else {
      setRows((r) =>
        r.map((x) =>
          x.key === row.key ? { ...x, enabled: next, hidden: !next } : x,
        ),
      );
    }
    setBusy(null);
  }

  async function toggleMaintenance(row: ConnectorRow) {
    const next = !row.maintenance;
    setBusy(`${row.key}:maint`);
    setErr(null);
    const res = await fetch("/api/admin/connectors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integration: row.key, maintenance: next }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErr(json?.error?.message ?? `Failed to update ${row.label}`);
    } else {
      setRows((r) =>
        r.map((x) => (x.key === row.key ? { ...x, maintenance: next } : x)),
      );
    }
    setBusy(null);
  }

  async function grant() {
    setGrantErr(null);
    if (!grantEmail.trim() || !grantIntegration) {
      setGrantErr("Provide a user email and select an integration.");
      return;
    }
    setGrantBusy(true);
    const res = await fetch("/api/admin/connectors/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: grantEmail.trim(), integration: grantIntegration }),
    });
    const json = await res.json();
    setGrantBusy(false);
    if (!res.ok || !json.success) {
      setGrantErr(json?.error?.message ?? "Failed to grant integration");
      return;
    }
    setGrantEmail("");
    setGrantIntegration("");
    await loadGrants();
  }

  async function revoke(g: GrantRow) {
    setGrantErr(null);
    const res = await fetch("/api/admin/connectors/grants", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: g.userId, integration: g.integration }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setGrantErr(json?.error?.message ?? "Failed to revoke");
      return;
    }
    await loadGrants();
  }

  const liveCount = rows.filter((r) => r.enabled && !r.hidden).length;
  const maintCount = rows.filter((r) => r.maintenance).length;
  const hiddenCount = rows.filter((r) => r.hidden).length;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="flex between items-center" style={{ marginBottom: 6 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>Connector availability</h3>
        <span className="badge badge-lime">
          {liveCount} / {rows.length || "—"} live
        </span>
      </div>
      <p style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Toggle a connector <strong>Live</strong> to release it to all users (it then
        appears on the webapp and marketing site), or <strong>Off</strong> to hide it
        again (admin-only). Flip <strong>Maintenance</strong> on to temporarily take a
        live connector down without disabling it permanently. Every change is audited.
      </p>

      {err && <div className="flash flash-error" style={{ marginTop: 0 }}>{err}</div>}

      {!loaded && !err && (
        <p className="dim" style={{ fontSize: 13 }}>Loading connectors…</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => {
          const live = row.enabled && !row.hidden;
          return (
            <div
              key={row.key}
              className="card"
              style={{
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: live ? "var(--s1)" : "var(--void)",
                borderColor: live ? "var(--lime-18)" : "var(--b1)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{row.label}</span>
                  <span className="badge" style={{ fontSize: 11 }}>{row.tag}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--t4)" }}>
                    {row.key}
                  </span>
                  {row.hidden && !row.enabled && (
                    <span className="badge" style={{ fontSize: 10, background: "rgba(139,126,255,0.12)", color: "var(--violet)" }}>
                      ADMIN ONLY
                    </span>
                  )}
                  {row.maintenance && (
                    <span className="badge" style={{ fontSize: 10, background: "rgba(245,166,35,0.1)", color: "var(--amber)" }}>
                      MAINTENANCE
                    </span>
                  )}
                </div>
                {row.note && (
                  <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>
                    {row.note}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <ToggleSwitch
                    on={live}
                    busy={busy === `${row.key}:live`}
                    label={`${live ? "Hide" : "Release"} ${row.label}`}
                    onToggle={() => toggleLive(row)}
                  />
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: live ? "var(--lime)" : "var(--t3)",
                      letterSpacing: ".06em",
                    }}
                  >
                    {live ? "LIVE" : "HIDDEN"}
                  </span>
                </div>

                <div
                  style={{
                    width: 1,
                    alignSelf: "stretch",
                    background: "var(--b1)",
                    margin: "0 4px",
                  }}
                />

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <ToggleSwitch
                    on={row.maintenance}
                    busy={busy === `${row.key}:maint`}
                    label={`Maintenance mode for ${row.label}`}
                    onToggle={() => toggleMaintenance(row)}
                  />
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: row.maintenance ? "var(--amber)" : "var(--t3)",
                      letterSpacing: ".06em",
                    }}
                  >
                    {row.maintenance ? "MAINT" : "READY"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {maintCount > 0 && (
        <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
          {maintCount} connector(s) currently in maintenance mode — hidden from end users.
        </p>
      )}

      {/* ── Enterprise custom grants ── */}
      <div style={{ marginTop: 28, borderTop: "1px solid var(--b1)", paddingTop: 20 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>Enterprise custom integrations</h3>
        <p style={{ fontSize: 13, marginTop: 0, marginBottom: 14 }}>
          Enable a built connector for a <strong>single</strong> enterprise user without
          making it globally live. The granted user sees and can run it; no one else and
          the public site never see it.
        </p>

        {grantErr && <div className="flash flash-error" style={{ marginTop: 0 }}>{grantErr}</div>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label className="label">User email</label>
            <input
              className="input"
              type="email"
              placeholder="enterprise@customer.com"
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              style={{ width: 240 }}
            />
          </div>
          <div>
            <label className="label">Integration</label>
            <select
              className="input"
              value={grantIntegration}
              onChange={(e) => setGrantIntegration(e.target.value)}
              style={{ width: 200 }}
            >
              <option value="">Select…</option>
              {rows.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            disabled={grantBusy}
            onClick={grant}
          >
            {grantBusy ? "Granting…" : "Grant"}
          </button>
        </div>

        {grants.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {grants.map((g) => (
              <div
                key={`${g.userId}:${g.integration}`}
                className="card"
                style={{
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "var(--s1)",
                  borderColor: "var(--lime-18)",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13 }}>{g.label}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--t3)" }}>
                  {g.userId}
                </span>
                <span style={{ fontSize: 11, color: "var(--t3)" }}>
                  granted {new Date(g.createdAt).toLocaleDateString()}
                </span>
                <button
                  className="btn"
                  style={{ marginLeft: "auto", padding: "4px 10px", fontSize: 12 }}
                  onClick={() => revoke(g)}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
        {grants.length === 0 && (
          <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
            No custom grants yet.
          </p>
        )}
      </div>
    </div>
  );
}
