import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/marketing/SiteNav";
import PricingGrid from "@/components/marketing/PricingGrid";
import { CONNECTOR_META } from "@/lib/connectors/meta";
import { LEGAL } from "@/lib/constants/compliance";

const LIME = "#c8f135";

export default function Home() {
  const integrations = Object.values(CONNECTOR_META); // 6
  const codeExample = `curl -X POST https://api.nukeapi.dev/v1/delete-user \\
  -H "Authorization: Bearer nk_live_••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subject_email": "jane@acme.com",
    "integrations": ["stripe","mailchimp","hubspot"]
  }'`;

  return (
    <div style={{ background: "#0a0a0c", color: "#d8d8d8", fontFamily: "'SF Mono','Fira Code',monospace", minHeight: "100vh" }}>
      <SiteNav />
      {/* HERO */}
      <section style={{ minHeight: "92vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "120px 6% 80px", position: "relative", overflow: "hidden" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 56, alignItems: "center" }} className="g2">
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#111114", border: "1px solid #252530", borderRadius: 100, padding: "7px 16px", fontSize: 13, color: "#666", marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: LIME, display: "inline-block" }} /> GDPR Art. 17 · CCPA · signed PDF audit trail
            </div>
            <h1 style={{ fontSize: "clamp(2.6rem,5.2vw,4.6rem)", fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1.05, marginBottom: 20 }}>
              Delete users.<br /><span style={{ color: LIME }}>Stay compliant.</span><br /><span style={{ color: "#303030" }}>One API call.</span>
            </h1>
            <p style={{ fontSize: 16, color: "#585868", maxWidth: 480, lineHeight: 1.85, marginBottom: 32 }}>
              NukeAPI wipes a user from Stripe, Mailchimp, HubSpot, Intercom and your database in parallel — then hands you a signed PDF audit trail. Live in 15 minutes.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 36 }}>
              <Link href="/signup"><button className="bp" style={{ padding: "14px 28px", borderRadius: 10, fontSize: 15 }}>Start for free →</button></Link>
              <Link href="/docs"><button className="bg" style={{ padding: "14px 28px", borderRadius: 10, fontSize: 15 }}>View docs</button></Link>
            </div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              {[["<50ms", "avg response"], ["6", "integrations"], ["GDPR+CCPA", "compliant"]].map(([v, l]) => (
                <div key={l}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: LIME }}>{v}</div><div style={{ fontSize: 11, color: "#383840", letterSpacing: ".07em", textTransform: "uppercase" }}>{l}</div></div>
              ))}
            </div>
          </div>
          <div style={{ background: "#0d0d10", border: "1px solid #1e1e24", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ background: "#111114", borderBottom: "1px solid #181820", padding: "12px 18px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e06060", display: "inline-block" }} />
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#d4943a", display: "inline-block" }} />
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#50c050", display: "inline-block" }} />
              <span style={{ marginLeft: 12, fontSize: 12, color: "#383840" }}>POST /api/v1/delete-user — curl</span>
            </div>
            <pre style={{ padding: 22, fontSize: 13, lineHeight: 1.85, color: "#8080a0", overflowX: "auto", whiteSpace: "pre" }}>{codeExample}</pre>
            <div style={{ borderTop: "1px solid #181820", padding: "14px 22px", background: "#0a0a0d" }}>
              <div style={{ fontSize: 11, color: "#2a2a38", marginBottom: 8, letterSpacing: ".08em" }}>RESPONSE · 200 OK · 48ms</div>
              <pre style={{ fontSize: 12, color: "#484858", lineHeight: 1.75 }}>{`{\n  "status": "completed",\n  "results": [\n    { "integration": "stripe",    "status": "success" },\n    { "integration": "mailchimp", "status": "success" },\n    { "integration": "hubspot",   "status": "success" }\n  ],\n  "auditSignature": "a1b2c3…"\n}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section id="integrations" style={{ padding: "80px 6%", background: "#080809" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: LIME, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 12 }}>Integrations</div>
          <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 10 }}>Covers your stack</h2>
          <p style={{ fontSize: 14, color: "#484858", marginBottom: 32 }}>{integrations.length} integrations — extensible via declarative engine</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {integrations.map((m) => (
              <div key={m.key} style={{ background: "#111114", border: "1px solid #1e1e24", borderRadius: 100, padding: "10px 18px", fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
                {m.label} <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: `${LIME}20`, color: LIME, letterSpacing: ".06em" }}>{m.tag}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "#383840", marginTop: 18 }}>Need another? <a href="mailto:hello@nukeapi.dev" style={{ color: LIME }}>Request it →</a></p>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "80px 6%" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 12, color: LIME, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 12 }}>Pricing</div>
            <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 8 }}>Pay for what you delete</h2>
            <p style={{ fontSize: 14, color: "#484858" }}>No seats. No hidden fees. Cancel anytime. Test mode now — live at launch.</p>
          </div>
          <PricingGrid mode="marketing" />
        </div>
      </section>

      {/* COMPLIANCE */}
      <section style={{ padding: "80px 6%", background: "#080809" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }} className="g2">
          <div>
            <div style={{ fontSize: 12, color: LIME, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 12 }}>Compliance</div>
            <h2 style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 12 }}>Built for the legal reality</h2>
            <p style={{ fontSize: 14, color: "#484858", lineHeight: 1.85 }}>GDPR 30 days, CCPA 45 days. Miss the deadline and fines start at €20M or 4% of global revenue — whichever is higher. Every deletion produces a signed PDF audit trail.</p>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              [LEGAL.gdpr.body, `${LEGAL.gdpr.responseDeadlineDays} days`, LEGAL.gdpr.maxPenalty],
              [LEGAL.ccpa.body, `${LEGAL.ccpa.responseDeadlineDays} days`, LEGAL.ccpa.maxPenalty],
              [LEGAL.lgpd.body, `${LEGAL.lgpd.responseDeadlineDays} days`, LEGAL.lgpd.maxPenalty],
            ].map(([name, deadline, penalty]) => (
              <div key={name} style={{ background: "#111114", border: "1px solid #1e1e24", borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div><div style={{ fontSize: 12, color: "#484858" }}>{deadline} deadline</div></div>
                <div style={{ fontSize: 11, color: "#383840", maxWidth: 220, textAlign: "right" }}>{penalty}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <SiteFooter />
      <style>{`@media(max-width:768px){.g2{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
