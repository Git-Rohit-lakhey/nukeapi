"use client";

import { useEffect, useState, useCallback } from "react";
import { LIVE_INTEGRATIONS } from "@/types/connector";

const LIVE_SET = new Set<string>(LIVE_INTEGRATIONS);

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
    </button>
  );
}

/**
 * Owner-only connector availability panel (ported from v1). The "Live" toggle
 * releases a connector to all users (landing, docs, dashboard, API) or hides
 * it again; "Maintenance" temporarily takes a live connector down without a
 * deploy. Every change is audited server-side. Catalog-only connectors without
 * a delete executor yet are marked SOON — flipping them live surfaces them in
 * the catalog, but saves/runs still return CONNECTOR_NOT_LIVE_YET until their
 * executor ships.
 */
export function OwnerConnectors() {
  const [rows, setRows] = useState<ConnectorRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/admin/connectors");
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErr(json?.error?.message ?? "Failed to load connectors");
      return;
    }
    if (!Array.isArray(json.data?.integrations)) {
      setErr("Unexpected connector list response");
      return;
    }
    setRows(json.data.integrations);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const liveCount = rows.filter((r) => r.enabled && !r.hidden).length;
  const maintCount = rows.filter((r) => r.maintenance).length;

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
        appears on the landing page, docs and dashboard), or <strong>Off</strong> to hide it
        again. Flip <strong>Maintenance</strong> on to temporarily take a
        live connector down without disabling it permanently. Every change is audited.
        Rows marked <strong>NO EXECUTOR</strong> have no delete engine yet — flipping them
        live only lists them as coming soon; saves and runs still return{" "}
        <span className="mono" style={{ fontSize: 12 }}>CONNECTOR_NOT_LIVE_YET</span> until their executor ships.
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
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{row.label}</span>
                  <span className="badge" style={{ fontSize: 11 }}>{row.tag}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--t4)" }}>
                    {row.key}
                  </span>
                  {row.hidden && !row.enabled && (
                    <span className="badge" style={{ fontSize: 10 }}>
                      HIDDEN
                    </span>
                  )}
                  {!LIVE_SET.has(row.key) && (
                    <span className="badge" style={{ fontSize: 10 }} title="No delete executor in this build yet">
                      NO EXECUTOR
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
    </div>
  );
}
