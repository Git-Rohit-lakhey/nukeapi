import Link from 'next/link'
import { DocsIntegrations } from '@/components/marketing/DocsIntegrations'
const LIME = '#c8f135'

export const metadata = {
  title: 'API Documentation — NukeAPI',
  description: 'Complete API reference for NukeAPI — GDPR & CCPA user deletion API.',
  alternates: { canonical: 'https://nukeapi.dev/docs' },
}

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/v1/delete-user',
    desc: 'Delete a user from all connected integrations. Returns JSON or a signed PDF audit report.',
    auth: 'Bearer API Key',
    body: `{
  "subject_email": "user@example.com",  // required — the user to delete
  "integrations": ["stripe",            // optional — defaults to all allowed + enabled
                   "mailchimp",
                   "hubspot"],
  "subject_external_id": "user_123",    // optional — your internal user ID
  "webhook": "https://..."              // optional — signed POST on completion
}`,
    response: `{
  "success": true,
  "requestId": "req_xxxxxxxx",
  "data": {
    "requestId": "req_xxxxxxxx",
    "status": "completed",          // "completed" | "partial" | "failed"
    "results": [
      { "integration": "stripe",    "status": "success", "message": "Deleted 1 customer(s)", "durationMs": 312 },
      { "integration": "mailchimp", "status": "success", "message": "Removed from 3 list(s)", "durationMs": 187 }
    ],
    "startedAt": "2026-07-01T10:00:00Z",
    "completedAt": "2026-07-01T10:00:01Z",
    "elapsedMs": 890,
    "auditSignature": "hex-hmac-sha256...",
    "usage": {
      "plan": "startup",
      "used": 14,
      "limit": 200,
      "remaining": 186,
      "overageRate": 0.5
    }
  }
}`,
    errors: [
      ['401', 'Missing or invalid API key'],
      ['403', 'INTEGRATION_NOT_ALLOWED — plan does not include the requested integration, or CONNECTOR_DISABLED — toggled off by the owner'],
      ['400', 'Validation error — invalid email or malformed request body'],
      ['402', 'QUOTA_EXCEEDED — monthly plan limit reached'],
      ['429', 'Rate limit (60 req/min per key) exceeded'],
      ['500', 'Deletion engine error — check results array for per-integration detail'],
    ],
  },
  {
    method: 'GET',
    path: '/api/v1/status/:requestId',
    desc: 'Fetch the result of a previous deletion request by ID.',
    auth: 'Bearer API Key',
    body: null,
    response: `{
  "success": true,
  "data": {
    "id": "req_xxxxxxxx",
    "status": "completed",
    "subject_email": "user@example.com",
    "integrations_requested": ["stripe", "mailchimp"],
    "integrations_completed": ["stripe", "mailchimp"],
    "integrations_failed": [],
    "created_at": "2026-07-01T10:00:00Z",
    "completed_at": "2026-07-01T10:00:01Z"
  }
}`,
    errors: [['404', 'Request ID not found']],
  },
]

const CODE_EXAMPLES = {
  curl: `curl -X POST https://nukeapi.dev/api/v1/delete-user \\
  -H "Authorization: Bearer nk_live_••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subject_email": "user@example.com",
    "integrations": ["mailchimp", "hubspot", "intercom"]
  }'`,
  node: `const res = await fetch('https://nukeapi.dev/api/v1/delete-user', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer nk_live_••••••••',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    subject_email: 'user@example.com',
    integrations: ['mailchimp', 'hubspot', 'intercom'],
  }),
})
const data = await res.json()
console.log(data.data.status) // "completed"`,
  python: `import requests

res = requests.post(
    'https://nukeapi.dev/api/v1/delete-user',
    headers={'Authorization': 'Bearer nk_live_••••••••'},
    json={
        'subject_email': 'user@example.com',
        'integrations': ['mailchimp', 'hubspot', 'intercom'],
    }
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
    "subject_email": "user@example.com",
    "integrations":  []string{"mailchimp", "hubspot", "intercom"},
  })
  req, _ := http.NewRequest("POST",
    "https://nukeapi.dev/api/v1/delete-user",
    bytes.NewReader(body),
  )
  req.Header.Set("Authorization", "Bearer nk_live_••••••••")
  req.Header.Set("Content-Type", "application/json")

  resp, _ := http.DefaultClient.Do(req)
  defer resp.Body.Close()
  var result map[string]any
  json.NewDecoder(resp.Body).Decode(&result)
  fmt.Println(result["data"].(map[string]any)["status"]) // completed
}`,
  rust: `use reqwest::Client;
use serde_json::json;

#[tokio::main]
async fn main() {
    let client = Client::new();
    let resp = client
        .post("https://nukeapi.dev/api/v1/delete-user")
        .bearer_auth("nk_live_••••••••")
        .json(&json!({
            "subject_email": "user@example.com",
            "integrations": ["mailchimp", "hubspot", "intercom"]
        }))
        .send()
        .await
        .unwrap();

    let data: serde_json::Value = resp.json().await.unwrap();
    println!("{}", data["data"]["status"]); // "completed"
}`,
  php: `<?php

$ch = curl_init('https://nukeapi.dev/api/v1/delete-user');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer nk_live_••••••••',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'subject_email' => 'user@example.com',
        'integrations' => ['mailchimp', 'hubspot', 'intercom'],
    ]),
    CURLOPT_RETURNTRANSFER => true,
]);

$resp = curl_exec($ch);
curl_close($ch);
$data = json_decode($resp, true);
echo $data['data']['status']; // completed`,
  ruby: `require 'net/http'
require 'json'

uri = URI('https://nukeapi.dev/api/v1/delete-user')
req = Net::HTTP::Post.new(uri)
req['Authorization'] = 'Bearer nk_live_••••••••'
req['Content-Type'] = 'application/json'
req.body = {
  subject_email: 'user@example.com',
  integrations: ['mailchimp', 'hubspot', 'intercom']
}.to_json

resp = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
  http.request(req)
end

data = JSON.parse(resp.body)
puts data['data']['status'] # completed`,
  java: `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class NukeApiExample {
    public static void main(String[] args) throws Exception {
        String json = """
            {
                "subject_email": "user@example.com",
                "integrations": ["mailchimp", "hubspot", "intercom"]
            }
            """;

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://nukeapi.dev/api/v1/delete-user"))
            .header("Authorization", "Bearer nk_live_••••••••")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();

        HttpResponse<String> resp = client.send(request,
            HttpResponse.BodyHandlers.ofString());
        System.out.println(resp.body());
    }
}`,
}

export default function DocsPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0c', color:'#d0d0d0', fontFamily:"'SF Mono','Fira Code',monospace", padding:'60px 5%' }}>
      <div style={{ maxWidth:800, margin:'0 auto', overflow:'hidden' }}>
        <div style={{ marginBottom:40 }}>
          <Link href="/" style={{ fontSize:'1.1rem', fontWeight:800, textDecoration:'none', color:'#e0e0e0' }}>
            <span style={{ color:LIME }}>Nuke</span>API
          </Link>
        </div>

        <h1 style={{ fontSize:'2rem', fontWeight:800, marginBottom:8, letterSpacing:'-.02em' }}>API Documentation</h1>
        <p style={{ color:'#484858', fontSize:'14px', marginBottom:48 }}>
          Base URL: <code style={{ color:LIME, background:'#111114', padding:'2px 8px', borderRadius:4 }}>https://nukeapi.dev</code>
          {' · '}
          <Link href="/signup" style={{ color:LIME }}>Get your API key →</Link>
        </p>

        <style>{`
          h2{font-size:1.2rem;font-weight:700;margin:48px 0 16px;color:#e0e0e0}
          h3{font-size:1rem;font-weight:700;margin:28px 0 10px;color:#e0e0e0}
          p{font-size:14px;line-height:1.85;color:#686878;margin-bottom:12px}
          li{font-size:14px;line-height:1.85;color:#686878;margin-bottom:6px}
          ul{padding-left:20px;margin-bottom:12px}
          code{background:#111114;padding:2px 6px;border-radius:4px;font-size:12px;color:${LIME}}
          pre{background:#0d0d10;border:1px solid #1e1e24;border-radius:10px;padding:20px;overflow-x:auto;margin:16px 0;max-width:100%}
          pre code{background:none;padding:0;color:#8080a0;font-size:12px;line-height:1.8;white-space:pre}
          table{width:100%;border-collapse:collapse;margin:16px 0;display:block;overflow-x:auto}
          td,th{border:1px solid #1e1e24;padding:10px 14px;font-size:13px;text-align:left}
          th{color:#e0e0e0;background:#111114}
          a{color:${LIME}}
        `}</style>

        {/* Authentication */}
        <h2>Authentication</h2>
        <p>All API requests require an API key passed in the <code>Authorization</code> header:</p>
        <pre><code>{`Authorization: Bearer nk_live_your_key_here`}</code></pre>
        <p>Create and manage API keys from your <Link href="/keys">dashboard</Link>. Keys are shown once at creation — store them securely.</p>

        {/* Quick Start */}
        <h2>Quick Start</h2>
        <p>Get your first deletion working in under 5 minutes:</p>

        {Object.entries(CODE_EXAMPLES).map(([lang, code]) => (
          <div key={lang}>
            <h3>{lang.toUpperCase()}</h3>
            <pre><code>{code}</code></pre>
          </div>
        ))}

        {/* Endpoints */}
        <h2>Endpoints</h2>
        {ENDPOINTS.map(ep => (
          <div key={ep.path} style={{ background:'#111114', border:'1px solid #1e1e24', borderRadius:12, padding:24, marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <span style={{ fontSize:'12px', fontWeight:800, padding:'3px 10px', borderRadius:6, background: ep.method==='POST' ? '#0d1600' : '#0e1e2a', color: ep.method==='POST' ? LIME : '#60a0e0', letterSpacing:'.08em' }}>{ep.method}</span>
              <code style={{ fontSize:'14px', color:'#e0e0e0', background:'none', padding:0 }}>{ep.path}</code>
            </div>
            <p style={{ marginBottom:14 }}>{ep.desc}</p>
            <p style={{ fontSize:'12px', color:'#383840', marginBottom:14 }}>Auth: <code>{ep.auth}</code></p>

            {ep.body && (
              <>
                <h3 style={{ fontSize:'12px', color:'#484858', letterSpacing:'.08em', marginBottom:8 }}>REQUEST BODY</h3>
                <pre><code>{ep.body}</code></pre>
              </>
            )}

            <h3 style={{ fontSize:'12px', color:'#484858', letterSpacing:'.08em', marginBottom:8 }}>RESPONSE</h3>
            <pre><code>{ep.response}</code></pre>

            <h3 style={{ fontSize:'12px', color:'#484858', letterSpacing:'.08em', marginBottom:8 }}>ERROR CODES</h3>
            <table>
              <thead><tr><th>Code</th><th>Meaning</th></tr></thead>
              <tbody>{ep.errors.map(([code, msg]) => <tr key={code}><td><code>{code}</code></td><td>{msg}</td></tr>)}</tbody>
            </table>
          </div>
        ))}

        {/* Rate limits */}
        <h2>Rate Limits</h2>
        <table>
          <thead><tr><th>Plan</th><th>Requests/min</th><th>Deletions/month</th><th>Overage</th></tr></thead>
          <tbody>
            <tr><td>Sandbox</td><td>60</td><td>20</td><td>None</td></tr>
            <tr><td>Startup</td><td>60</td><td>200</td><td>$0.50 / deletion</td></tr>
            <tr><td>Business</td><td>60</td><td>1,000</td><td>$0.35 / deletion</td></tr>
            <tr><td>Enterprise</td><td>Custom</td><td>Unlimited</td><td>Included</td></tr>
          </tbody>
        </table>

        {/* Available integrations */}
        <h2>Available Integrations</h2>
        <p>
          Availability is controlled by the account owner. Every connector below
          is toggleable on/off from the owner dashboard — a disabled or hidden
          connector cannot be connected or run, and any request targeting it
          returns a <code>403 CONNECTOR_DISABLED</code>. Only connectors the owner
          has released are listed here; newly-built connectors stay hidden until
          released.
        </p>
        {/**
          * Client-rendered so the list reflects live owner toggles: hidden
          * connectors never appear, released ones appear automatically.
          */}
        <DocsIntegrations />

        {/* Partial failures */}
        <h2>Partial Failures</h2>
        <p>Each integration runs independently. If one fails, the others still complete. The response <code>status</code> field reflects the aggregate outcome:</p>
        <ul>
          <li><code>completed</code> — all requested integrations succeeded</li>
          <li><code>partial</code> — some succeeded, some failed</li>
          <li><code>failed</code> — all integrations failed</li>
        </ul>
        <p>Usage is only incremented on <code>completed</code> and <code>partial</code> — not on full failures.</p>

        {/* PDF audit */}
        <h2>PDF Audit Reports</h2>
        <p>Download a signed PDF audit trail for any deletion request from your dashboard under Deletions → Details → Download PDF. The PDF includes the request ID, subject email, per-integration results, timestamps, duration, and a cryptographic HMAC-SHA256 signature — suitable for GDPR Article 17 compliance records.</p>
        <p>PDF generation is available on the Startup plan and above.</p>
        <p>PDFs are also downloadable any time from your dashboard under Deletions → Details → Download PDF (Startup plan and above).</p>

        <div style={{ marginTop:56, paddingTop:24, borderTop:'1px solid #141418', fontSize:'13px', color:'#383840' }}>
          <Link href="/" style={{ color:LIME }}>← Back to NukeAPI</Link>
          {' · '}
          <Link href="/signup" style={{ color:LIME }}>Get started free →</Link>
          {' · '}
          <a href="mailto:hello@nukeapi.dev" style={{ color:LIME }}>hello@nukeapi.dev</a>
        </div>
      </div>
    </div>
  )
}
