"use client";

import { useEffect, useState } from "react";
import { ALL_CONNECTOR_META } from "@/lib/connectors/meta";
import { LIVE_INTEGRATIONS } from "@/types/connector";

const LIVE_SET = new Set<string>(LIVE_INTEGRATIONS);

const LIME = "#c8f135";
const COLLAPSED_COUNT = 28;

/**
 * Integrations catalog grid (ported from v1's LandingPage UX): shows the
 * first 28 integrations with a "Show all N integrations →" expander and a
 * "Show less ↑" collapser. Live badges are lime, maintenance amber, and
 * coming-soon grey. Live state comes from /api/connectors/availability so an
 * owner toggle in /owner reflects here with no deploy; before it loads we
 * fall back to enabledByDefault.
 */
export default function IntegrationsGrid() {
  const [showAll, setShowAll] = useState(false);
  const [liveMap, setLiveMap] = useState<Record<string, boolean> | null>(null);
  const [maintMap, setMaintMap] = useState<Record<string, boolean>>({});
  const [runnableMap, setRunnableMap] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/connectors/availability");
        const json = await res.json();
        if (cancelled || !res.ok || !json?.success) return;
        const live: Record<string, boolean> = {};
        const maint: Record<string, boolean> = {};
        const runnable: Record<string, boolean> = {};
        for (const i of json.data.integrations as Array<{
          key: string;
          visible: boolean;
          maintenance: boolean;
          runnable?: boolean;
        }>) {
          live[i.key] = i.visible;
          if (i.maintenance) maint[i.key] = true;
          if (typeof i.runnable === "boolean") runnable[i.key] = i.runnable;
        }
        setLiveMap(live);
        setMaintMap(maint);
        setRunnableMap(runnable);
      } catch {
        // fall back to enabledByDefault below
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // "Live" means owner-released AND actually runnable. An owner-enabled
  // catalog entry without a delete executor yet still shows as coming soon —
  // the API would reject it with CONNECTOR_NOT_LIVE_YET, so the badge must
  // never promise otherwise.
  const isRunnable = (key: string) =>
    runnableMap ? (runnableMap[key] ?? LIVE_SET.has(key)) : LIVE_SET.has(key);
  const isLive = (key: string, enabledByDefault: boolean) =>
    (liveMap ? (liveMap[key] ?? false) : enabledByDefault) && isRunnable(key);

  const visible = showAll ? ALL_CONNECTOR_META : ALL_CONNECTOR_META.slice(0, COLLAPSED_COUNT);
  const liveCount = ALL_CONNECTOR_META.filter((m) => isLive(m.key, m.enabledByDefault)).length;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: LIME, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 12 }}>Integrations</div>
      <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 10, color: "#fff" }}>Covers your stack</h2>
      <p style={{ fontSize: 14, color: "#55555f", marginBottom: 32 }}>
        {ALL_CONNECTOR_META.length} integrations — {liveCount} live today, more shipping monthly
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 24 }}>
        {visible.map((m) => {
          const live = isLive(m.key, m.enabledByDefault);
          const maint = Boolean(maintMap[m.key]);
          const badgeText = maint ? "MAINT" : live ? m.tag : `${m.tag} · soon`;
          const badgeColor = maint ? "#f5a623" : live ? LIME : "#4a4a55";
          const badgeBg = maint ? "rgba(245,166,35,.12)" : live ? `${LIME}20` : "#181820";
          return (
            <div
              key={m.key}
              title={m.note ?? m.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "#111114",
                border: "1px solid #1e1e24",
                borderRadius: 100,
                padding: "8px 8px 8px 16px",
              }}
            >
              <span style={{ color: live && !maint ? "#d8d8d8" : "#5a5a66", fontSize: 13.5 }}>{m.label}</span>
              <span style={{ fontSize: 10.5, padding: "3px 9px", borderRadius: 100, background: badgeBg, color: badgeColor, letterSpacing: ".06em", whiteSpace: "nowrap" }}>
                {badgeText}
              </span>
            </div>
          );
        })}
      </div>
      {!showAll && ALL_CONNECTOR_META.length > COLLAPSED_COUNT && (
        <button onClick={() => setShowAll(true)} className="bg" style={{ padding: "11px 22px", borderRadius: 10, fontSize: 13.5, marginBottom: 20, cursor: "pointer" }}>
          Show all {ALL_CONNECTOR_META.length} integrations →
        </button>
      )}
      {showAll && (
        <button onClick={() => setShowAll(false)} className="bg" style={{ padding: "11px 22px", borderRadius: 10, fontSize: 13.5, marginBottom: 20, cursor: "pointer" }}>
          Show less ↑
        </button>
      )}
      <p style={{ fontSize: 13, color: "#3d3d48", marginTop: showAll ? 20 : 0 }}>
        Need another system? <a href="mailto:hello@nukeapi.dev" style={{ color: LIME }}>Request it →</a>
      </p>
    </div>
  );
}
