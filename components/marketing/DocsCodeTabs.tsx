"use client";

import { useState } from "react";

const LIME = "#c8f135";

const CODE_EXAMPLES: Record<string, string> = {
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
};

const LANGS = Object.keys(CODE_EXAMPLES);

export function DocsCodeTabs() {
  const [active, setActive] = useState("curl");
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(CODE_EXAMPLES[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 0, borderBottom: "1px solid #1e1e24", marginBottom: 0 }}>
        {LANGS.map((lang) => (
          <button
            key={lang}
            onClick={() => setActive(lang)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: active === lang ? `2px solid ${LIME}` : "2px solid transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "12px",
              padding: "10px 12px",
              letterSpacing: ".04em",
              color: active === lang ? LIME : "#444",
              marginBottom: "-1px",
              transition: "all .15s",
            }}
          >
            {lang}
          </button>
        ))}
        <button
          onClick={copy}
          style={{
            marginLeft: "auto",
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
      <pre style={{ background: "#0d0d10", border: "1px solid #1e1e24", borderTop: "none", borderRadius: "0 0 10px 10px", padding: 20, overflow: "auto", margin: 0 }}>
        <code style={{ background: "none", padding: 0, color: "#8080a0", fontSize: "12px", lineHeight: 1.8, whiteSpace: "pre" }}>
          {CODE_EXAMPLES[active]}
        </code>
      </pre>
    </div>
  );
}
