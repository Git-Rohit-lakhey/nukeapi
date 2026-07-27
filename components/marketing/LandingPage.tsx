"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/marketing/SiteNav";
import { getSupabaseBrowser } from "@/lib/db/browser";

const LIME = "#c8f135";
const PURPLE = "#a855f7";

export default function LandingPage() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"curl" | "node" | "python" | "go" | "rust" | "php" | "ruby" | "java">("curl");
  const [scrolled, setScrolled] = useState(false);
  const [tick, setTick] = useState(0);
  const [yearly, setYearly] = useState(false); // reference: monthly default
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Live connector availability from the owner-controlled flags. Until the
  // fetch resolves we fall back to the static `live` defaults below.
  const [liveOverrides, setLiveOverrides] = useState<Record<string, boolean>>({});
  const [maintOverrides, setMaintOverrides] = useState<Record<string, boolean>>({});
  const [showAllIntegrations, setShowAllIntegrations] = useState(false);

  async function goToCheckout(plan: "startup" | "business" | "enterprise") {
    setCheckoutLoading(plan);
    setCheckoutError(null);
    try {
      const sb = getSupabaseBrowser();
      const {
        data: { session },
      } = await sb.auth.getSession();
      const email = session?.user?.email;

      if (!email) {
        window.location.assign(`/signup?plan=${plan}&yearly=${yearly}`);
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing: yearly ? "yearly" : "monthly" }),
      });
      const data = await res.json();

      if (data.success && data.data?.checkoutUrl) {
        window.location.assign(data.data.checkoutUrl);
      } else if (res.status === 401) {
        window.location.assign(`/signup?plan=${plan}&yearly=${yearly}`);
      } else {
        const errMsg = data?.error?.message || data?.error || "Checkout unavailable";
        setCheckoutError(
          errMsg.includes("not configured")
            ? "Billing is not configured yet. Please contact hello@nukeapi.dev"
            : `${errMsg}. Please try again or contact hello@nukeapi.dev`,
        );
        setCheckoutLoading(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      if (msg.includes("Supabase env")) {
        window.location.assign(`/signup?plan=${plan}&yearly=${yearly}`);
      } else {
        setCheckoutError("Something went wrong. Please try again.");
      }
      setCheckoutLoading(null);
    }
  }

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((p) => p + 1), 3400);
    return () => clearInterval(t);
  }, []);

  // Reflect the owner's live connector toggles (and maintenance) on the homepage.
  useEffect(() => {
    fetch("/api/connectors/availability")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.data?.integrations)) {
          const o: Record<string, boolean> = {};
          const m: Record<string, boolean> = {};
          for (const i of d.data.integrations) {
            o[i.label] = i.visible;
            m[i.label] = Boolean(i.maintenance);
          }
          setLiveOverrides(o);
          setMaintOverrides(m);
        }
      })
      .catch(() => {
        /* keep static defaults */
      });
  }, []);

  const CODE: Record<string, string> = {
    curl: `curl -X POST https://api.nukeapi.dev/v1/delete-user \\
  -H "Authorization: Bearer nk_live_••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subject_email": "jane@acme.com",
    "integrations": ["stripe","mailchimp","hubspot"]
  }'`,
    node: `import { NukeAPI } from '@nukeapi/sdk'

const nuke = new NukeAPI('nk_live_••••••••')

const result = await nuke.deleteUser({
  subject_email: 'jane@acme.com',
  integrations: ['stripe', 'mailchimp', 'hubspot'],
})

console.log(result.status) // "completed"`,
    python: `import requests

res = requests.post(
    'https://api.nukeapi.dev/v1/delete-user',
    headers={'Authorization': 'Bearer nk_live_••••••••'},
    json={
        'subject_email': 'jane@acme.com',
        'integrations': ['stripe', 'mailchimp', 'hubspot'],
    },
)
print(res.json()['data']['status'])  # "completed"`,
    go: `package main

import (
  "bytes"
  "encoding/json"
  "fmt"
  "net/http"
)

func main() {
  body, _ := json.Marshal(map[string]any{
    "subject_email": "jane@acme.com",
    "integrations":  []string{"stripe", "mailchimp", "hubspot"},
  })
  req, _ := http.NewRequest("POST",
    "https://api.nukeapi.dev/v1/delete-user",
    bytes.NewBuffer(body))
  req.Header.Set("Authorization", "Bearer nk_live_••••••••")
  req.Header.Set("Content-Type", "application/json")

  resp, _ := http.DefaultClient.Do(req)
  fmt.Println(resp.Status) // 200 OK
}`,
    rust: `use reqwest::Client;
use serde_json::json;

#[tokio::main]
async fn main() {
    let client = Client::new();
    let res = client
        .post("https://api.nukeapi.dev/v1/delete-user")
        .header("Authorization", "Bearer nk_live_••••••••")
        .json(&json!({
            "subject_email": "jane@acme.com",
            "integrations": ["stripe", "mailchimp", "hubspot"]
        }))
        .send()
        .await
        .unwrap();

    println!("{}", res.status()); // 200 OK
}`,
    php: `<?php

$ch = curl_init('https://api.nukeapi.dev/v1/delete-user');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer nk_live_••••••••',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'subject_email' => 'jane@acme.com',
        'integrations'  => ['stripe', 'mailchimp', 'hubspot'],
    ]),
    CURLOPT_RETURNTRANSFER => true,
]);

$resp = curl_exec($ch);
curl_close($ch);
echo json_decode($resp, true)['data']['status']; // completed`,
    ruby: `require 'net/http'
require 'json'

uri = URI('https://api.nukeapi.dev/v1/delete-user')
req = Net::HTTP::Post.new(uri)
req['Authorization'] = 'Bearer nk_live_••••••••'
req['Content-Type']  = 'application/json'
req.body = {
  subject_email: 'jane@acme.com',
  integrations:  ['stripe', 'mailchimp', 'hubspot']
}.to_json

resp = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
puts JSON.parse(resp.body)['data']['status'] # completed`,
    java: `import java.net.URI;
import java.net.http.*;

public class NukeExample {
  public static void main(String[] args) throws Exception {
    String json = """
      {"subject_email":"jane@acme.com","integrations":["stripe","mailchimp","hubspot"]}
      """;

    HttpClient client = HttpClient.newHttpClient();
    HttpRequest req = HttpRequest.newBuilder()
      .uri(URI.create("https://api.nukeapi.dev/v1/delete-user"))
      .header("Authorization", "Bearer nk_live_••••••••")
      .header("Content-Type", "application/json")
      .POST(HttpRequest.BodyPublishers.ofString(json))
      .build();

    HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
    System.out.println(resp.statusCode()); // 200
  }
}`,
  };

  function copy() {
    navigator.clipboard.writeText(CODE[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const S: Record<string, React.CSSProperties> = {
    page: {
      background: "#0a0a0c",
      color: "#d8d8d8",
      fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
      minHeight: "100vh",
      fontSize: "16px",
      lineHeight: 1.6,
    },
    section: { padding: "96px 6%" },
    altBg: { padding: "96px 6%", background: "#080809" },
    inner: { maxWidth: 1080, margin: "0 auto" },
    eyebrow: {
      fontSize: "12px",
      color: LIME,
      letterSpacing: ".14em",
      marginBottom: 16,
      textTransform: "uppercase" as const,
    },
    h2: {
      fontSize: "clamp(1.9rem,3vw,2.6rem)",
      fontWeight: 800,
      letterSpacing: "-.03em",
      lineHeight: 1.15,
      marginBottom: 20,
    },
    body: { fontSize: "16px", color: "#606070", lineHeight: 1.85 },
  };

  const INTEG_LOGS = [
    { name: "stripe", color: "#635bff", icon: "S", status: "deleted", email: "user_7f2@acme.com", ms: 312 },
    { name: "mailchimp", color: "#ffe01b", icon: "M", status: "deleted", email: "user_a9k@corp.io", ms: 187 },
    { name: "hubspot", color: "#ff7a59", icon: "H", status: "deleted", email: "user_3bc@startup.dev", ms: 445 },
    { name: "intercom", color: "#1f8ded", icon: "I", status: "deleted", email: "user_9qr@saas.co", ms: 223 },
    { name: "supabase", color: "#3ecf8e", icon: "S", status: "deleted", email: "user_2xz@app.dev", ms: 156 },
  ];
  const visibleLogs = INTEG_LOGS.slice(0, Math.min(5, (tick % 6) + 1));

  const INTEGRATIONS = [
    // Batch 1 — core / most popular
    { n: "Stripe", tag: "Payments", live: true },
    { n: "Mailchimp", tag: "Email", live: true },
    { n: "HubSpot", tag: "CRM", live: true },
    { n: "Intercom", tag: "Support", live: true },
    { n: "Supabase", tag: "Database", live: true },
    { n: "PostgreSQL", tag: "Database", live: true },
    { n: "Salesforce", tag: "CRM", live: false },
    { n: "Segment", tag: "Analytics", live: false },
    { n: "Klaviyo", tag: "Email", live: false },
    { n: "SendGrid", tag: "Email", live: false },
    { n: "Auth0", tag: "Auth", live: false },
    { n: "Clerk", tag: "Auth", live: false },
    { n: "PostHog", tag: "Analytics", live: false },
    { n: "Zendesk", tag: "Support", live: false },
    { n: "Mixpanel", tag: "Analytics", live: false },
    { n: "MySQL", tag: "Database", live: false },
    { n: "PlanetScale", tag: "Database", live: false },
    { n: "Neon", tag: "Database", live: false },
    { n: "MongoDB", tag: "Database", live: false },
    { n: "Firestore", tag: "Database", live: false },
    { n: "ConvertKit", tag: "Email", live: false },
    { n: "ActiveCampaign", tag: "Email", live: false },
    { n: "Resend", tag: "Email", live: false },
    { n: "Drip", tag: "Email", live: false },
    { n: "Amplitude", tag: "Analytics", live: false },
    { n: "FullStory", tag: "Analytics", live: false },
    { n: "Heap", tag: "Analytics", live: false },
    { n: "Paddle", tag: "Payments", live: false },
    // Batch 2 — extended catalog
    { n: "Braintree", tag: "Payments", live: false },
    { n: "Chargebee", tag: "Payments", live: false },
    { n: "Recurly", tag: "Payments", live: false },
    { n: "Pipedrive", tag: "CRM", live: false },
    { n: "Freshdesk", tag: "Support", live: false },
    { n: "Crisp", tag: "Support", live: false },
    { n: "Firebase Auth", tag: "Auth", live: false },
    { n: "Okta", tag: "Auth", live: false },
    { n: "Stytch", tag: "Auth", live: false },
    { n: "Turso", tag: "Database", live: false },
    { n: "Upstash Redis", tag: "Database", live: false },
    { n: "Elasticsearch", tag: "Search", live: false },
    { n: "Cassandra", tag: "Database", live: false },
    { n: "WorkOS", tag: "Auth", live: false },
    { n: "Cognito", tag: "Auth", live: false },
    { n: "Keycloak", tag: "Auth", live: false },
    { n: "Brevo", tag: "Email", live: false },
    { n: "Omnisend", tag: "Email", live: false },
    { n: "Beehiiv", tag: "Email", live: false },
    { n: "Loops", tag: "Email", live: false },
    { n: "Customer.io", tag: "Email", live: false },
    { n: "Linear", tag: "Project Mgmt", live: false },
    { n: "Help Scout", tag: "Support", live: false },
    { n: "Gorgias", tag: "Support", live: false },
    { n: "Groove", tag: "Support", live: false },
    { n: "Smartlook", tag: "Analytics", live: false },
    { n: "LogRocket", tag: "Analytics", live: false },
    { n: "Datadog", tag: "Monitoring", live: false },
    { n: "Pendo", tag: "Analytics", live: false },
    { n: "Lemon Squeezy", tag: "Payments", live: false },
    { n: "Gumroad", tag: "Payments", live: false },
    { n: "Zuora", tag: "Payments", live: false },
    { n: "AWS S3", tag: "Storage", live: false },
    { n: "Cloudflare R2", tag: "Storage", live: false },
    { n: "Google Cloud Storage", tag: "Storage", live: false },
    { n: "Vercel Blob", tag: "Storage", live: false },
    { n: "Twilio", tag: "Commms", live: false },
    { n: "Vonage", tag: "Commms", live: false },
    { n: "Plivo", tag: "Commms", live: false },
    { n: "Notion", tag: "Productivity", live: false },
    { n: "Airtable", tag: "Database", live: false },
    { n: "Webflow", tag: "CMS", live: false },
    { n: "Memberstack", tag: "Auth", live: false },
    { n: "Outseta", tag: "Auth", live: false },
    { n: "Braze", tag: "Marketing", live: false },
    { n: "Iterable", tag: "Marketing", live: false },
    { n: "Vero", tag: "Marketing", live: false },
    { n: "Passage (1Password)", tag: "Auth", live: false },
    { n: "Substack", tag: "Email", live: false },
    { n: "June", tag: "Analytics", live: false },
  ];

  const isLive = (name: string): boolean => {
    if (name in liveOverrides) return liveOverrides[name];
    return INTEGRATIONS.find((i) => i.n === name)?.live ?? false;
  };
  const metaLiveCount = INTEGRATIONS.filter((i) => isLive(i.n)).length;

  const PLANS = [
    {
      name: "Sandbox",
      priceM: 0,
      priceY: 0,
      desc: "For solo devs and local testing.",
      feats: ["20 deletions / month", "3 integrations", "JSON response only", "Test console access", "Community support"],
      cta: "Start free",
      feat: false,
    },
    {
      name: "Startup",
      priceM: 99,
      priceY: 990,
      desc: "For growing SaaS products handling user data",
      feats: ["200 deletions / month", "Up to 8 integrations", "+$0.50 per extra deletion", "PDF audit reports", "Webhook callbacks", "Priority email support"],
      cta: "Start trial",
      feat: true,
    },
    {
      name: "Business",
      priceM: 299,
      priceY: 2990,
      desc: "For funded startups passing SOC 2 or GDPR audits",
      feats: ["1,000 deletions / month", "Up to 20 integrations", "+$0.35 per extra deletion", "Custom HTTP connectors", "Audit-log export", "Slack & email alerts"],
      cta: "Start trial",
      feat: false,
    },
    {
      name: "Enterprise",
      priceM: 699,
      priceY: 6990,
      desc: "For high-volume teams needing unlimited deletions and dedicated support.",
      feats: ["Unlimited deletions", "Unlimited integrations", "Custom connectors", "SOC 2 export", "SSO / SAML", "White-label PDF reports", "Dedicated support SLA"],
      cta: "Start trial",
      feat: false,
    },
  ];

  return (
    <div style={S.page}>
      <SiteNav />
      <style>{`
        ::selection{background:${LIME};color:#000}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:3px}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(200,241,53,.5)}70%{box-shadow:0 0 0 10px rgba(200,241,53,0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .up{animation:fadeUp .55s ease both}
        .d1{animation-delay:.1s}.d2{animation-delay:.2s}.d3{animation-delay:.3s}.d4{animation-delay:.45s}
        .slide{animation:slideIn .35s ease both}
        .fc{background:#111114;border:1px solid #1e1e24;border-radius:14px;padding:24px;transition:all .2s}
        .fc:hover{border-color:#2c2c36;transform:translateY(-2px)}
        .pc{background:#111114;border:1px solid #1e1e24;border-radius:14px;padding:24px;display:flex;flex-direction:column;transition:all .2s}
        .pc:hover{border-color:#2c2c36}
        .pc.feat{border-color:rgba(200,241,53,.45);background:#0d1600}
        .pill{background:#111114;border:1px solid #1e1e24;border-radius:100px;padding:10px 20px;font-size:14px;display:flex;align-items:center;gap:10px;transition:all .15s}
        .pill:hover{border-color:rgba(200,241,53,.35)}
        .tab{background:transparent;border:none;cursor:pointer;font-family:inherit;font-size:11px;padding:10px 10px;letter-spacing:.04em;color:#444;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;white-space:nowrap}
        .tab.on{color:${LIME};border-bottom-color:${LIME}}
        @media(max-width:768px){.g2,.g3,.fg{grid-template-columns:1fr!important}.nl{display:none!important}}
      `}</style>

      {/* HERO */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "120px 6% 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(rgba(200,241,53,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(200,241,53,.022) 1px,transparent 1px)`,
            backgroundSize: "52px 52px",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "18%",
            left: "35%",
            width: 700,
            height: 500,
            background: `radial-gradient(circle,${LIME}05 0%,transparent 68%)`,
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative", width: "100%" }}>
          <div className="g2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
            {/* LEFT */}
            <div>
              <div
                className="up"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  background: "#111114",
                  border: "1px solid #252530",
                  borderRadius: 100,
                  padding: "7px 16px",
                  fontSize: "13px",
                  color: "#666",
                  marginBottom: 36,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: LIME,
                    animation: "pulse 2s infinite",
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                GDPR Art. 17 · CCPA · signed PDF audit trail
              </div>

              <h1
                className="up d1"
                style={{ fontSize: "clamp(2.6rem,5.5vw,4.8rem)", fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1.04, marginBottom: 28 }}
              >
                Delete users.
                <br />
                <span style={{ color: LIME }}>Stay compliant.</span>
                <br />
                <span style={{ color: "#303030" }}>One API call.</span>
              </h1>

              <p
                className="up d2"
                style={{ fontSize: "clamp(1rem,1.8vw,1.2rem)", color: "#585868", maxWidth: 480, lineHeight: 1.85, marginBottom: 44 }}
              >
                NukeAPI wipes a user from Stripe, Mailchimp, HubSpot, Intercom, and your database in parallel — then hands you a
                signed PDF audit trail for your lawyers.
              </p>

              <div className="up d3" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 56 }}>
                <Link href="/signup">
                  <button className="bp" style={{ padding: "14px 28px", borderRadius: 10, fontSize: "15px" }}>
                    Start for free →
                  </button>
                </Link>
                <Link href="/docs">
                  <button className="bg" style={{ padding: "14px 28px", borderRadius: 10, fontSize: "15px" }}>
                    View docs
                  </button>
                </Link>
              </div>

              <div className="up d4" style={{ display: "flex", gap: 44, flexWrap: "wrap", marginBottom: 32 }}>
                {[
                  ["<50ms", "avg response"],
                  ["99.9%", "uptime SLA"],
                  [String(INTEGRATIONS.length), "integrations"],
                  ["GDPR+CCPA", "compliant"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: LIME, letterSpacing: "-.02em" }}>{v}</div>
                    <div style={{ fontSize: "12px", color: "#383840", marginTop: 4, letterSpacing: ".07em", textTransform: "uppercase" }}>{l}</div>
                  </div>
                ))}
              </div>
              <div className="up d4" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#333", marginRight: 4 }}>Works with:</span>
                {["Node.js", "Python", "Go", "Rust", "PHP", "Ruby", "Java", "curl"].map((lang) => (
                  <span
                    key={lang}
                    style={{ fontSize: "11px", padding: "3px 9px", borderRadius: 4, background: "#111114", border: "1px solid #1e1e24", color: "#484858", letterSpacing: ".04em" }}
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>

            {/* RIGHT — Live deletion visualiser */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  inset: -24,
                  background: `radial-gradient(circle,${LIME}06 0%,transparent 70%)`,
                  pointerEvents: "none",
                  borderRadius: 32,
                }}
              />
              <div style={{ background: "#0d0d10", border: "1px solid #1e1e24", borderRadius: 20, overflow: "hidden", position: "relative" }}>
                <div style={{ background: "#111114", borderBottom: "1px solid #181820", padding: "12px 20px", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#e06060" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#d4943a" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#50c050" }} />
                  <span style={{ marginLeft: 12, fontSize: "12px", color: "#383840", letterSpacing: ".06em" }}>POST /api/v1/delete-user</span>
                  <span style={{ marginLeft: "auto", fontSize: "11px", color: "#1e1e24" }}>200 OK</span>
                </div>

                <div style={{ padding: "20px", borderBottom: "1px solid #141418", background: "#0a0a0c" }}>
                  <div style={{ fontSize: "11px", color: "#383840", letterSpacing: ".08em", marginBottom: 10 }}>REQUEST</div>
                  <pre style={{ fontSize: "12px", color: "#6a6a8a", lineHeight: 1.8 }}>{`{
  "subject_email": "jane@acme.com",
  "integrations": [
    "stripe", "mailchimp",
    "hubspot"
  ]
}`}</pre>
                </div>

                <div style={{ padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: "11px", color: "#383840", letterSpacing: ".08em" }}>DELETION LOG</span>
                    <span style={{ fontSize: "11px", color: LIME, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: LIME, display: "inline-block", animation: "pulse 1.5s infinite" }} />
                      LIVE
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 160 }}>
                    {visibleLogs.map((log, i) => (
                      <div
                        key={log.name}
                        className="slide"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          background: "#111114",
                          borderRadius: 8,
                          border: "1px solid #1a1a20",
                          animationDelay: `${i * 0.1}s`,
                        }}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: log.color + "22",
                            border: `1px solid ${log.color}40`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            fontWeight: 800,
                            color: log.color,
                            flexShrink: 0,
                          }}
                        >
                          {log.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, textTransform: "capitalize", color: "#c0c0c0" }}>{log.name}</div>
                          <div style={{ fontSize: "11px", color: "#383840", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.email}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: "11px", color: "#383840" }}>{log.ms}ms</span>
                          <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: 4, background: "#0e2a0e", color: "#50c050", letterSpacing: ".05em" }}>DELETED</span>
                        </div>
                      </div>
                    ))}

                    {visibleLogs.length < INTEG_LOGS.length && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", opacity: 0.4 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: "#1a1a1e", border: "1px solid #2a2a2e" }} />
                        <div style={{ width: 80, height: 8, borderRadius: 4, background: "#1a1a1e" }} />
                        <div style={{ marginLeft: "auto", width: 6, height: 14, background: LIME, animation: "blink 1s infinite" }} />
                      </div>
                    )}
                  </div>

                  {visibleLogs.length >= 3 && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: "10px 14px",
                        background: `${LIME}0d`,
                        border: `1px solid ${LIME}25`,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: "14px" }}>📄</span>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: LIME }}>Audit PDF ready</div>
                        <div style={{ fontSize: "11px", color: "#484848" }}>Signed · GDPR Art. 17 compliant</div>
                      </div>
                      <span style={{ marginLeft: "auto", fontSize: "10px", color: "#383840" }}>nukeapi-audit-bf4c.pdf</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CODE DEMO */}
      <section style={S.altBg}>
        <div style={S.inner}>
          <div className="g2" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 48, alignItems: "center" }}>
            <div>
              <div style={S.eyebrow}>The API</div>
              <h2 style={S.h2}>One endpoint.<br />Every integration.</h2>
              <p style={{ ...S.body, marginBottom: 32 }}>
                Send a single request with the user email. NukeAPI fans out to every connected integration in parallel, collects
                results, logs the audit trail, and returns a signed PDF — all in under a second.
              </p>
              {[
                ["Parallel execution", "All integrations run simultaneously, not one by one"],
                ["Partial success reporting", "If HubSpot fails, Stripe still completes — you see exactly what happened"],
                ["Signed PDF receipt", "Every deletion produces a timestamped compliance document"],
              ].map(([t, d]) => (
                <div key={t} style={{ display: "flex", gap: 14, marginBottom: 20 }}>
                  <span style={{ color: LIME, marginTop: 2, flexShrink: 0, fontSize: "15px" }}>✓</span>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: 4 }}>{t}</div>
                    <div style={{ fontSize: "14px", color: "#505060", lineHeight: 1.7 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#0d0d10", border: "1px solid #1e1e24", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid #181820", padding: "0 4px" }}>
                {(["curl", "node", "python", "go", "rust", "php", "ruby", "java"] as const).map((t) => (
                  <button key={t} className={`tab${activeTab === t ? " on" : ""}`} onClick={() => setActiveTab(t)}>
                    {t}
                  </button>
                ))}
                <button
                  onClick={copy}
                  style={{
                    marginLeft: "auto",
                    marginRight: 8,
                    alignSelf: "center",
                    background: "#181820",
                    border: "1px solid #242430",
                    color: "#666",
                    borderRadius: 6,
                    padding: "4px 12px",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all .15s",
                  }}
                >
                  {copied ? "✓ copied" : "copy"}
                </button>
              </div>
              <pre style={{ padding: "24px", fontSize: "13px", lineHeight: 1.85, color: "#8080a0", overflowX: "auto", whiteSpace: "pre", minHeight: 220 }}>
                <code>{CODE[activeTab]}</code>
              </pre>
              <div style={{ borderTop: "1px solid #181820", padding: "16px 24px", background: "#0a0a0d" }}>
                <div style={{ fontSize: "11px", color: "#2a2a38", marginBottom: 10, letterSpacing: ".08em" }}>RESPONSE · 200 OK · 48ms</div>
                <pre style={{ fontSize: "12px", color: "#484858", lineHeight: 1.75 }}>{`{
  "status": "completed",
  "results": [
    { "integration": "stripe",    "status": "success" },
    { "integration": "mailchimp", "status": "success" },
    { "integration": "hubspot",   "status": "success" }
  ],
  "auditSignature": "a1b2c3…",
  "usage": { "plan": "startup", "used": 41, "limit": 200 }
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={S.section}>
        <div style={S.inner}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={S.eyebrow}>How it works</div>
            <h2 style={{ ...S.h2, marginBottom: 0 }}>Live in 15 minutes</h2>
          </div>
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            {[
              ["01", "Get your API key", "Sign up free. Your key is ready instantly — no sales call, no waitlist."],
              ["02", "Connect integrations", "Paste your Stripe, Mailchimp, and HubSpot keys into your dashboard. Takes 3 minutes."],
              ["03", "Call the API", "One POST request with the user email. Works from any language or framework."],
              ["04", "Download the audit PDF", "Every deletion produces a signed PDF. Store it for your lawyers or compliance review."],
            ].map(([n, t, d], i) => (
              <div key={n} style={{ display: "flex", gap: 24, paddingBottom: i < 3 ? 44 : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      border: `2px solid ${LIME}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 800,
                      color: LIME,
                    }}
                  >
                    {n}
                  </div>
                  {i < 3 && <div style={{ width: 2, flex: 1, background: `linear-gradient(to bottom,${LIME},transparent)`, marginTop: 8 }} />}
                </div>
                <div style={{ paddingTop: 9 }}>
                  <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: 7 }}>{t}</div>
                  <div style={{ fontSize: "14px", color: "#505060", lineHeight: 1.8 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section id="integrations" style={S.altBg}>
        <div style={{ ...S.inner, textAlign: "center" }}>
          <div style={S.eyebrow}>Integrations</div>
          <h2 style={{ ...S.h2, marginBottom: 12 }}>Covers your entire stack</h2>
          <p style={{ fontSize: "15px", color: "#484858", marginBottom: 48 }}>
            {INTEGRATIONS.length} integrations — more shipping monthly
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 24 }}>
            {(showAllIntegrations ? INTEGRATIONS : INTEGRATIONS.slice(0, 28)).map(({ n, tag }) => {
              const live = isLive(n);
              const maint = Boolean(maintOverrides[n]);
              const badgeText = maint ? "MAINT" : tag;
              const badgeColor = maint ? "#f5a623" : live ? LIME : "#303038";
              const badgeBg = maint ? "rgba(245,166,35,0.12)" : live ? `${LIME}20` : "#181820";
              return (
                <div key={n} className="pill">
                  <span style={{ color: live && !maint ? "#d8d8d8" : "#333", fontSize: "14px" }}>{n}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: badgeBg,
                      color: badgeColor,
                      letterSpacing: ".06em",
                    }}
                  >
                    {badgeText}
                  </span>
                </div>
              );
            })}
          </div>
          {!showAllIntegrations && INTEGRATIONS.length > 28 && (
            <button
              onClick={() => setShowAllIntegrations(true)}
              className="btn"
              style={{ marginBottom: 20 }}
            >
              Show all {INTEGRATIONS.length} integrations →
            </button>
          )}
          {showAllIntegrations && (
            <button
              onClick={() => setShowAllIntegrations(false)}
              className="btn"
              style={{ marginBottom: 20 }}
            >
              Show less ↑
            </button>
          )}
          <p style={{ fontSize: "14px", color: "#383840", marginTop: showAllIntegrations ? 20 : 0 }}>
            Need a custom integration?{" "}
            <a href="mailto:hello@nukeapi.dev" style={{ color: LIME, textDecoration: "underline", textUnderlineOffset: 4 }}>
              Request it →
            </a>
          </p>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={S.section}>
        <div style={S.inner}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={S.eyebrow}>Pricing</div>
            <h2 style={{ ...S.h2, marginBottom: 10 }}>Pay for what you delete</h2>
            <p style={{ fontSize: "15px", color: "#484858" }}>No seats. No hidden fees. Cancel any time.</p>
          </div>

          {checkoutError && (
            <div
              style={{
                background: "#2a1010",
                border: "1px solid #4a1a1a",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 20,
                fontSize: "13px",
                color: "#e06060",
                textAlign: "center",
              }}
            >
              {checkoutError}
            </div>
          )}

          {/* Monthly / Yearly toggle */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
            <div style={{ display: "inline-flex", background: "#111114", border: "1px solid #1e1e24", borderRadius: 100, padding: 4, gap: 4 }}>
              <button
                onClick={() => setYearly(false)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 100,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: !yearly ? LIME : "transparent",
                  color: !yearly ? "#000" : "#666",
                  transition: "all .15s",
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setYearly(true)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 100,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: yearly ? LIME : "transparent",
                  color: yearly ? "#000" : "#666",
                  transition: "all .15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Yearly
                <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: 4, background: yearly ? "#000" : "#0d1600", color: LIME }}>
                  2 months free
                </span>
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
            {PLANS.map(({ name, priceM, priceY, desc, feats, cta, feat }) => {
              const price = yearly ? (priceY === 0 ? "$0" : `$${Math.round(priceY / 12)}`) : `$${priceM}`;
              const per = priceM === 0 ? "forever" : "/ month";
              const isEnt = name === "Enterprise";
              const planSlug = name.toLowerCase() as "sandbox" | "startup" | "business" | "enterprise";
              return (
                <div
                  key={name}
                  className={`pc${feat ? " feat" : ""}`}
                  style={
                    isEnt
                      ? {
                          background: "#0e0814",
                          border: "1px solid rgba(168,85,247,.5)",
                          boxShadow: "0 0 32px rgba(168,85,247,.12), 0 0 64px rgba(168,85,247,.06)",
                          borderRadius: 16,
                          padding: 32,
                          display: "flex",
                          flexDirection: "column",
                        }
                      : {}
                  }
                >
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 800,
                      letterSpacing: ".08em",
                      marginBottom: 12,
                      color: isEnt ? PURPLE : feat ? LIME : "#888",
                    }}
                  >
                    {name.toUpperCase()}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: "2.6rem", fontWeight: 900, letterSpacing: "-.04em" }}>{price}</span>
                    <span style={{ fontSize: "14px", color: "#343440" }}>{per}</span>
                  </div>
                  {yearly && priceM > 0 && <div style={{ fontSize: "12px", color: LIME, marginBottom: 10 }}>billed ${priceY} / year</div>}
                  {(!yearly || priceM === 0) && <div style={{ marginBottom: 10 }} />}
                  <p style={{ fontSize: "14px", color: "#484858", lineHeight: 1.7, marginBottom: 24 }}>{desc}</p>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11, marginBottom: 28 }}>
                    {feats.map((f) => (
                      <div key={f} style={{ display: "flex", gap: 10, fontSize: "14px", color: "#686878" }}>
                        <span style={{ color: isEnt ? PURPLE : LIME, flexShrink: 0 }}>✓</span>
                        {f}
                      </div>
                    ))}
                  </div>
                  {planSlug === "sandbox" ? (
                    <Link href="/signup" style={{ display: "block" }}>
                      <button className="bg" style={{ padding: "13px", borderRadius: 8, fontSize: "14px", width: "100%" }}>
                        Start free
                      </button>
                    </Link>
                  ) : (
                    <button
                      onClick={() => goToCheckout(planSlug as "startup" | "business" | "enterprise")}
                      disabled={checkoutLoading === planSlug}
                      className={feat ? "bp" : isEnt ? "bp" : "bg"}
                      style={{
                        padding: "13px",
                        borderRadius: 8,
                        fontSize: "14px",
                        width: "100%",
                        ...(isEnt ? { background: PURPLE, color: "#fff" } : {}),
                      }}
                    >
                      {checkoutLoading === planSlug ? "Loading…" : cta}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ textAlign: "center", marginTop: 28, fontSize: "13px", color: "#2c2c38" }}>
            Need unlimited deletions?{" "}
            <a href="mailto:hello@nukeapi.dev" style={{ color: LIME }}>
              Talk to us about Business →
            </a>
          </p>
        </div>
      </section>

      {/* ROI CALCULATOR — "The Math" */}
      <section style={S.altBg}>
        <div style={S.inner}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={S.eyebrow}>The Math</div>
            <h2 style={{ ...S.h2, marginBottom: 12 }}>
              Why $99/month is not a cost.
              <br />
              It is a 10x saving.
            </h2>
            <p style={{ fontSize: "16px", color: "#585868", maxWidth: 520, margin: "0 auto", lineHeight: 1.8 }}>
              Businesses buy on ROI, not price. Here is the calculation your finance team will run.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, alignItems: "center", maxWidth: 860, margin: "0 auto 56px" }}>
            <div style={{ background: "#111114", border: "1px solid #2a1010", borderRadius: 16, padding: 32 }}>
              <div style={{ fontSize: "12px", color: "#8b2020", letterSpacing: ".1em", marginBottom: 16 }}>WITHOUT NUKEAPI</div>
              {[
                ["Engineer hourly rate", "$80 – $150 / hr"],
                ["Hours per DSAR", "3 – 4 hours"],
                ["Cost per deletion", "$240 – $600"],
                ["10 DSARs per month", "$2,400 – $6,000"],
                ["Annual cost", "$28,800 – $72,000"],
                ["Legal risk if missed", "Up to €20M or 4% of revenue"],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1e1218" }}>
                  <span style={{ fontSize: "14px", color: "#585868" }}>{l}</span>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#e06060" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "#111114",
                  border: "1px solid #2a2a30",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#484858",
                  margin: "0 auto",
                }}
              >
                VS
              </div>
            </div>
            <div style={{ background: "#0d1600", border: `1px solid ${LIME}40`, borderRadius: 16, padding: 32 }}>
              <div style={{ fontSize: "12px", color: LIME, letterSpacing: ".1em", marginBottom: 16 }}>WITH NUKEAPI</div>
              {[
                ["Setup time", "15 minutes"],
                ["Cost per deletion", "$0.50 avg"],
                ["10 DSARs per month", "$5 in API calls"],
                ["Annual cost", "$99 – $299 / month"],
                ["Legal risk", "PDF audit trail included"],
                ["Engineer time saved", "100%"],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid #1a2200` }}>
                  <span style={{ fontSize: "14px", color: "#585868" }}>{l}</span>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: LIME }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 48,
              flexWrap: "wrap",
              background: "#0d1600",
              border: `1px solid ${LIME}20`,
              borderRadius: 16,
              padding: "32px 40px",
              maxWidth: 860,
              margin: "0 auto",
            }}
          >
            {[
              ["10x", "cheaper than manual handling"],
              ["15 min", "to full integration"],
              ["100%", "engineer time saved on DSARs"],
              ["€20M+", "in potential fines per GDPR violation"],
            ].map(([v, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 900, color: LIME, letterSpacing: "-.03em", lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: "13px", color: "#484858", marginTop: 6, maxWidth: 160 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPLIANCE */}
      <section id="compliance" style={S.section}>
        <div style={S.inner}>
          <div className="g2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            <div>
              <div style={S.eyebrow}>Compliance</div>
              <h2 style={S.h2}>Built for the legal reality of running SaaS</h2>
              <p style={{ ...S.body, marginBottom: 20 }}>
                Under GDPR, you have 30 days to respond to a deletion request. Under CCPA, 45 days. Miss the deadline and fines
                start at €20M or 4% of global revenue — whichever is higher.
              </p>
              <p style={S.body}>
                NukeAPI gives you a signed PDF audit trail for every deletion — the exact document your lawyers need to demonstrate
                compliance.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { law: "GDPR Art. 17", region: "EU & 180+ countries", deadline: "30 days", fine: "€20M or 4% of global revenue" },
                { law: "CCPA / CPRA", region: "California, USA", deadline: "45 days", fine: "$7,500 per violation" },
                { law: "LGPD", region: "Brazil", deadline: "15 days", fine: "Up to 2% of revenue" },
              ].map(({ law, region, deadline, fine }) => (
                <div
                  key={law}
                  style={{
                    background: "#0d0d10",
                    border: "1px solid #1e1e24",
                    borderRadius: 12,
                    padding: "18px 22px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: 4 }}>{law}</div>
                    <div style={{ fontSize: "13px", color: "#383840" }}>{region}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "14px", color: LIME, marginBottom: 3 }}>{deadline} deadline</div>
                    <div style={{ fontSize: "13px", color: "#8b2020" }}>{fine}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={S.altBg}>
        <div style={S.inner}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={S.eyebrow}>Features</div>
            <h2 style={{ ...S.h2, marginBottom: 0 }}>Everything you need. Nothing you don&apos;t.</h2>
          </div>
          <div className="fg" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[
              { icon: "⚡", title: "Parallel execution", desc: "All integrations run simultaneously. A 5-integration deletion completes in the time of the slowest single API call." },
              { icon: "📄", title: "Signed PDF audit trail", desc: "Every deletion generates a timestamped PDF — ready for your lawyers, auditors, or SOC 2 review." },
              { icon: "🔁", title: "Retry with backoff", desc: "If an integration times out, NukeAPI retries with exponential backoff and reports exactly what succeeded." },
              { icon: "🔑", title: "API key management", desc: "Create, revoke, and scope API keys from your dashboard. Keys are bcrypt-hashed — never stored in plaintext." },
              { icon: "🛡️", title: "Zero plaintext creds", desc: "Your Stripe and HubSpot keys are AES-256 encrypted at rest. Never logged, never exposed in any response." },
              { icon: "📊", title: "Admin error console", desc: "Full error logs with stack traces, severity levels, and per-request context — so you know exactly what broke." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="fc">
                <div style={{ fontSize: "1.8rem", marginBottom: 16 }}>{icon}</div>
                <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: 10 }}>{title}</div>
                <div style={{ fontSize: "14px", color: "#505060", lineHeight: 1.75 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEVELOPER ECOSYSTEM */}
      <section id="developers" style={S.altBg}>
        <div style={S.inner}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={S.eyebrow}>Developer ecosystem</div>
            <h2 style={{ ...S.h2, marginBottom: 10 }}>Use NukeAPI your way</h2>
            <p style={{ fontSize: "15px", color: "#484858" }}>
              An official SDK, an n8n community node, and an MCP server — pick the integration surface that fits your stack.
            </p>
          </div>

          <style>{`
            .devg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;width:100%;max-width:960px;margin:0 auto}
            .devcard{background:#0d0d10;border:1px solid #1e1e24;border-radius:16px;padding:28px 20px;display:flex;flex-direction:column;transition:all .2s;width:100%;text-align:center;align-items:center}
            .devcard:hover{border-color:#2c2c36;transform:translateY(-2px)}
            .devcode{background:#08080a;border:1px solid #16161c;border-radius:10px;padding:16px;font-size:12px;line-height:1.7;color:#8080a0;overflow-x:auto;margin:0 0 16px;font-family:'SF Mono','Fira Code',monospace;text-align:left;width:100%}
            .devlink{color:${LIME};font-size:14px;font-weight:600;text-decoration:none}
            .devlink:hover{text-decoration:underline;text-underline-offset:4px}
            @media(max-width:768px){.devg{grid-template-columns:1fr!important}}
          `}</style>

          <div className="devg">
            {/* SDK */}
            <div className="devcard">
              <div style={{ fontSize: "22px", marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: 8 }}>Official SDK</div>
              <p style={{ fontSize: "14px", color: "#505060", lineHeight: 1.75, marginBottom: 18, flex: 1 }}>
                Typed TypeScript SDK for Node & browser. Delete a user across every connected integration in three lines.
              </p>
              <pre className="devcode">{`npm install @nukeapi/sdk

import { NukeAPI } from '@nukeapi/sdk'

const nuke = new NukeAPI({ apiKey: 'nk_live_...' })
await nuke.deleteUser({ subject_email, integrations })`}</pre>
              <Link href="/docs" className="devlink">SDK docs →</Link>
            </div>

            {/* n8n */}
            <div className="devcard">
              <div style={{ fontSize: "22px", marginBottom: 12 }}>🔗</div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: 8 }}>n8n node</div>
              <p style={{ fontSize: "14px", color: "#505060", lineHeight: 1.75, marginBottom: 18, flex: 1 }}>
                Drop NukeAPI into any n8n workflow — no code. Connect your API key, pick integrations, run.
              </p>
              <pre className="devcode">{`npm install n8n-nodes-nukeapi
# or copy the built folder into ~/.n8n/custom`}</pre>
              <Link href="/docs" className="devlink">n8n docs →</Link>
            </div>

            {/* MCP */}
            <div className="devcard">
              <div style={{ fontSize: "22px", marginBottom: 12 }}>🤖</div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: 8 }}>MCP server</div>
              <p style={{ fontSize: "14px", color: "#505060", lineHeight: 1.75, marginBottom: 18, flex: 1 }}>
                Let Claude Desktop or Cursor delete users for you via the Model Context Protocol.
              </p>
              <pre className="devcode">{`{
  "mcpServers": {
    "nukeapi": {
      "command": "npx",
      "args": ["tsx", "/path/to/nukeapi/mcp/server.ts"],
      "env": {
        "NUKEAPI_BASE_URL": "https://nukeapi.dev",
        "NUKEAPI_API_KEY": "nk_live_..."
      }
    }
  }
}`}</pre>
              <Link href="/docs" className="devlink">MCP docs →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ ...S.section, textAlign: "center" }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <div style={S.eyebrow}>Get started</div>
          <h2 style={{ fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1.08, marginBottom: 24 }}>
            Your next DSAR email
            <br />
            is already on its way.
          </h2>
          <p style={{ fontSize: "16px", color: "#505060", lineHeight: 1.8, marginBottom: 40 }}>
            Be ready before it arrives. Set up takes 15 minutes.
            <br />
            The first 20 deletions are free.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup">
              <button className="bp" style={{ padding: "16px 36px", borderRadius: 10, fontSize: "15px" }}>
                Get your free API key
              </button>
            </Link>
            <a href="mailto:hello@nukeapi.dev">
              <button className="bg" style={{ padding: "16px 36px", borderRadius: 10, fontSize: "15px" }}>
                Contact us
              </button>
            </a>
          </div>
          <p style={{ marginTop: 20, fontSize: "13px", color: "#282830" }}>
            No credit card required · <a href="/dpa" style={{ color: "#484858" }}>DPA available</a>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
