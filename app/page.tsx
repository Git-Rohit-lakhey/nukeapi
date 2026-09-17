import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/marketing/SiteNav";
import PricingGrid from "@/components/marketing/PricingGrid";
import IntegrationsGrid from "@/components/marketing/IntegrationsGrid";
import { LEGAL } from "@/lib/constants/compliance";

const LIME = "#c8f135";

const STEPS = [
  ["01", "Get your API key", "Sign up free. Sandbox gives you 20 deletions — no sales call, no waitlist."],
  ["02", "Connect integrations", "Paste your Stripe, Mailchimp and HubSpot keys in the dashboard. Encrypted at rest, takes 3 minutes."],
  ["03", "Call the API", "One POST with the user email. Fan-out runs in parallel with timeout + retry and honest partial results."],
  ["04", "Keep the signed PDF", "Every deletion is HMAC-signed and downloadable — the exact artifact auditors ask for."],
] as const;

const FEATURES = [
  ["⚡", "Parallel execution", "All integrations run at once via Promise.allSettled — one failure never hides another result."],
  ["📄", "Signed PDF audit trail", "HMAC-SHA256 over the canonical result, stored on the row and embedded in the PDF."],
  ["🔁", "Retry with backoff", "10s timeout, 2 retries on 429/5xx only — never on 4xx. Hung APIs can't hang your request."],
  ["🔑", "Honest API keys", "bcrypt + indexed SHA-256 lookup. Raw key shown once, never stored."],
  ["🛡️", "Zero plaintext creds", "AES-256-GCM server-side. The browser never sees the key, the DB never sees plaintext."],
  ["📊", "Usage that adds up", "Atomic Postgres RPC metering — concurrent deletes can't undercount your quota."],
] as const;

const FAQS = [
  ["How fast can I go live?", "About 15 minutes: sign up, connect one integration, create a key, send your first POST. The docs page has copy-paste curl for every live integration."],
  ["What happens if one integration fails?", "You get HTTP 207 partial with per-integration status. Stripe can succeed while HubSpot fails — nothing is silently dropped, and usage still counts the attempt."],
  ["How does billing work?", "Checkout is via Dodo Payments. The webhook upgrades your plan automatically. Cancel anytime — we call Dodo's API first, then mark you cancelled. Test mode uses card 4242 4242 4242 4242."],
  ["Is my data encrypted?", "Yes. Connector credentials are AES-256-GCM envelopes {v,iv,tag,data}. API keys are bcrypt hashes. Audit rows are HMAC-signed."],
] as const;

export default function Home() {
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
      <section style={{ minHeight: "94vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "128px 6% 88px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(200,241,53,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(200,241,53,.025) 1px,transparent 1px)", backgroundSize: "52px 52px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "12%", left: "30%", width: 720, height: 480, background: `radial-gradient(circle,${LIME}08 0%,transparent 68%)`, pointerEvents: "none" }} />
        <div style={{ maxWidth: 1080, margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 56, alignItems: "center", position: "relative" }} className="g2">
          <div className="anim-fadeUp">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#111114", border: "1px solid #252530", borderRadius: 100, padding: "7px 16px", fontSize: 12.5, color: "#8a8a95", marginBottom: 28 }}>
              <span className="badge badge-lime" style={{ border: "none", background: "transparent", padding: 0 }}><span className="dot" /></span> GDPR Art. 17 · CCPA · signed PDF audit trail
            </div>
            <h1 style={{ fontSize: "clamp(2.6rem,5.2vw,4.6rem)", fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1.04, marginBottom: 20, color: "#fff" }}>
              Delete users.<br /><span style={{ color: LIME }}>Stay compliant.</span><br /><span style={{ color: "#2e2e2e" }}>One API call.</span>
            </h1>
            <p style={{ fontSize: 15.5, color: "#5c5c68", maxWidth: 480, lineHeight: 1.85, marginBottom: 32 }}>
              NukeAPI wipes a user from Stripe, Mailchimp, HubSpot, Intercom and your database in parallel — then hands you a signed PDF audit trail. Live in 15 minutes.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
              <Link href="/signup"><button className="bp" style={{ padding: "14px 28px", borderRadius: 10, fontSize: 15 }}>Start for free →</button></Link>
              <Link href="/docs"><button className="bg" style={{ padding: "14px 28px", borderRadius: 10, fontSize: 15 }}>View docs</button></Link>
            </div>
            <p style={{ fontSize: 12, color: "#3a3a44", marginBottom: 32 }}>Free Sandbox · 20 deletions/mo · no credit card</p>
            <div style={{ display: "flex", gap: 36, flexWrap: "wrap", borderTop: "1px solid #15151a", paddingTop: 24 }}>
                {[["<50ms", "avg response"], ["78", "integrations"], ["207/429", "honest statuses"]].map(([v, l]) => (
                <div key={l}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: LIME, letterSpacing: "-.02em" }}>{v}</div><div style={{ fontSize: 11, color: "#3d3d48", letterSpacing: ".07em", textTransform: "uppercase", marginTop: 4 }}>{l}</div></div>
              ))}
            </div>
          </div>
          <div className="anim-fadeUp" style={{ background: "#0d0d10", border: "1px solid #1e1e24", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
            <div style={{ background: "#111114", borderBottom: "1px solid #181820", padding: "12px 18px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e06060", display: "inline-block" }} />
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#d4943a", display: "inline-block" }} />
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#50c050", display: "inline-block" }} />
              <span style={{ marginLeft: 12, fontSize: 12, color: "#4a4a55" }}>POST /api/v1/delete-user</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: LIME }}>200 OK</span>
            </div>
            <pre style={{ padding: 22, fontSize: 13, lineHeight: 1.85, color: "#9a9ab0", overflowX: "auto", whiteSpace: "pre", margin: 0 }}>{codeExample}</pre>
            <div style={{ borderTop: "1px solid #181820", padding: "14px 22px", background: "#0a0a0d" }}>
              <div style={{ fontSize: 11, color: "#3d3d4a", marginBottom: 8, letterSpacing: ".08em" }}>RESPONSE · 200 OK · 48ms</div>
              <pre style={{ fontSize: 12.5, color: "#6a6a80", lineHeight: 1.75, margin: 0 }}>{`{\n  "status": "completed",\n  "results": [\n    { "integration": "stripe",    "status": "success" },\n    { "integration": "mailchimp", "status": "success" },\n    { "integration": "hubspot",   "status": "success" }\n  ],\n  "auditSignature": "a1b2c3…"\n}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "88px 6%", borderTop: "1px solid #121218" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ fontSize: 12, color: LIME, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 12 }}>How it works</div>
          <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 36, color: "#fff" }}>Live in 15 minutes</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }} className="g4">
            {STEPS.map(([n, t, d]) => (
              <div key={n} className="card card-hover" style={{ padding: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: LIME, letterSpacing: ".1em", marginBottom: 10 }}>{n}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#fff" }}>{t}</div>
                <div style={{ fontSize: 13, color: "#5c5c68", lineHeight: 1.75 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "88px 6%", background: "#080809", borderTop: "1px solid #121218" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ fontSize: 12, color: LIME, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 12 }}>Why NukeAPI</div>
          <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 36, color: "#fff" }}>Everything you need. Nothing you don&apos;t.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="g3">
            {FEATURES.map(([icon, t, d]) => (
              <div key={t} className="card card-hover" style={{ padding: 22 }}>
                <div style={{ fontSize: 22, marginBottom: 12 }}>{icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#fff" }}>{t}</div>
                <div style={{ fontSize: 13, color: "#5c5c68", lineHeight: 1.75 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section id="integrations" style={{ padding: "88px 6%", borderTop: "1px solid #121218" }}>
        <IntegrationsGrid />
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "88px 6%", background: "#080809", borderTop: "1px solid #121218" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 12, color: LIME, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 12 }}>Pricing</div>
            <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 8, color: "#fff" }}>Pay for what you delete</h2>
            <p style={{ fontSize: 14, color: "#55555f" }}>No seats. No hidden fees. Cancel anytime. Test mode now — live at launch.</p>
          </div>
          <PricingGrid mode="marketing" />
        </div>
      </section>

      {/* COMPLIANCE */}
      <section style={{ padding: "88px 6%", borderTop: "1px solid #121218" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }} className="g2">
          <div>
            <div style={{ fontSize: 12, color: LIME, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 12 }}>Compliance</div>
            <h2 style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 12, color: "#fff" }}>Built for the legal reality</h2>
            <p style={{ fontSize: 14, color: "#55555f", lineHeight: 1.85 }}>GDPR gives you 30 days, CCPA 45. Miss it and fines start at €20M or 4% of global revenue — whichever is higher. Every deletion produces a signed PDF your lawyers can file.</p>
            <div style={{ marginTop: 20 }}><Link href="/dpa"><button className="bg" style={{ padding: "11px 20px", borderRadius: 9, fontSize: 13.5 }}>Read the DPA →</button></Link></div>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              [LEGAL.gdpr.body, `${LEGAL.gdpr.responseDeadlineDays} days`, LEGAL.gdpr.maxPenalty],
              [LEGAL.ccpa.body, `${LEGAL.ccpa.responseDeadlineDays} days`, LEGAL.ccpa.maxPenalty],
              [LEGAL.lgpd.body, `${LEGAL.lgpd.responseDeadlineDays} days`, LEGAL.lgpd.maxPenalty],
            ].map(([name, deadline, penalty]) => (
              <div key={name} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <div><div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{name}</div><div style={{ fontSize: 12, color: LIME, marginTop: 2 }}>{deadline} deadline</div></div>
                <div style={{ fontSize: 11.5, color: "#55555f", maxWidth: 240, textAlign: "right", lineHeight: 1.6 }}>{penalty}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "88px 6%", background: "#080809", borderTop: "1px solid #121218" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontSize: 12, color: LIME, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 12, textAlign: "center" }}>FAQ</div>
          <h2 style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 28, textAlign: "center", color: "#fff" }}>Questions, answered</h2>
          {FAQS.map(([q, a]) => (
            <details key={q} style={{ background: "#111114", border: "1px solid #1c1c22", borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#fff" }}>{q}</summary>
              <p style={{ fontSize: 13.5, color: "#5c5c68", lineHeight: 1.8, marginTop: 10 }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "88px 6%", borderTop: "1px solid #121218" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", background: `linear-gradient(180deg, #0e1500, #0a0d00)`, border: `1px solid ${LIME}30`, borderRadius: 20, padding: "56px 48px", textAlign: "center", boxShadow: "0 30px 80px rgba(200,241,53,.08)" }}>
          <h2 style={{ fontSize: "clamp(1.6rem,3.4vw,2.6rem)", fontWeight: 900, letterSpacing: "-.03em", color: "#fff", marginBottom: 12 }}>Your next DSAR email is already on its way.</h2>
          <p style={{ fontSize: 14, color: "#8a8a55", marginBottom: 28 }}>Be ready before it arrives. 15 minutes to full integration. First 20 deletions free.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup"><button className="bp" style={{ padding: "14px 32px", borderRadius: 10, fontSize: 15 }}>Get your free API key</button></Link>
            <a href="mailto:hello@nukeapi.dev"><button className="bg" style={{ padding: "14px 32px", borderRadius: 10, fontSize: 15 }}>Contact us</button></a>
          </div>
        </div>
      </section>

      <SiteFooter />
      <style>{`@media(max-width:900px){.g2{grid-template-columns:1fr!important}.g3{grid-template-columns:1fr!important}.g4{grid-template-columns:1fr 1fr!important}}@media(max-width:560px){.g4{grid-template-columns:1fr!important}}details summary::-webkit-details-marker{display:none}`}</style>
    </div>
  );
}
