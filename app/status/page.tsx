"use client";

import { useEffect, useState } from "react";
import { SiteNav, SiteFooter } from "@/components/marketing/SiteNav";

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

export default function StatusPage() {
  const [status, setStatus] = useState<string>("loading");
  const [checks, setChecks] = useState<Check[]>([]);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const start = Date.now();
      try {
        const res = await fetch("/api/status");
        const json = await res.json();
        const elapsed = Date.now() - start;
        if (!active) return;
        setPingMs(elapsed);
        setStatus(json.data?.status ?? "unknown");
        setChecks(json.data?.checks ?? []);
        setLastChecked(new Date().toLocaleTimeString());
      } catch {
        if (active) {
          setStatus("unknown");
          setChecks([]);
        }
      }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  const color =
    status === "operational"
      ? "var(--emerald)"
      : status === "loading"
        ? "var(--amber)"
        : "var(--rose)";

  const label =
    status === "loading"
      ? "Checking…"
      : status === "unknown"
        ? "UNKNOWN"
        : status.toUpperCase();

  return (
    <>
      <SiteNav />
      <main className="container container-wide page">
        <p className="eyebrow">status</p>
        <h1>System status</h1>
        <p className="dim" style={{ fontSize: 13, marginBottom: 20 }}>
          Database and API tested live on page load (8-second timeout), auto-refreshing every 30s.
        </p>

        {/* Overall */}
        <div className="card">
          <div className="flex items-center gap-12">
            <span style={{ width: 12, height: 12, borderRadius: 99, background: color }} />
            <span style={{ fontWeight: 800, fontSize: 20, color }}>{label}</span>
          </div>
          {(pingMs !== null || lastChecked) && (
            <p className="dim" style={{ fontSize: 13, marginTop: 10 }}>
              {pingMs !== null && <>Health check responded in {pingMs}ms · </>}
              {lastChecked && <>Checked at {lastChecked}</>}
            </p>
          )}
        </div>

        {/* Stats (from the reference design) */}
        <div className="grid grid-2" style={{ marginTop: 20 }}>
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--lime)", letterSpacing: ".1em", marginBottom: 8 }}>UPTIME</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: status === "operational" ? "var(--emerald)" : "var(--rose)", letterSpacing: "-.03em" }}>
              {status === "loading" ? "…" : status === "operational" ? "ONLINE" : "OFFLINE"}
            </div>
            <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>Live health status</div>
          </div>
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--lime)", letterSpacing: ".1em", marginBottom: 8 }}>RESPONSE TIME</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "var(--emerald)", letterSpacing: "-.03em" }}>
              {pingMs !== null ? `${pingMs}ms` : status === "loading" ? "…" : "N/A"}
            </div>
            <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>Live measurement</div>
          </div>
        </div>

        {/* Live checks (from this app's /api/status) */}
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ marginTop: 0 }}>
            {checks.length === 0 ? (
              <p className="dim">No checks reported.</p>
            ) : (
              checks.map((c) => (
                <div
                  key={c.name}
                  className="flex between items-center"
                  style={{ padding: "10px 0", borderBottom: "1px solid var(--b1)" }}
                >
                  <span>{c.name}</span>
                  <span style={{ color: c.ok ? "var(--emerald)" : "var(--rose)", fontFamily: "var(--mono)", fontSize: 13 }}>
                    {c.ok ? "OPERATIONAL" : "DEGRADED"}
                    {c.detail ? ` · ${c.detail}` : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 20, lineHeight: 1.7 }}>
          Experiencing an issue?{" "}
          <a href="mailto:hello@nukeapi.dev" style={{ color: "var(--lime)" }}>
            hello@nukeapi.dev
          </a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
