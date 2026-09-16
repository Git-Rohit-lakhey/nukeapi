"use client";

import { useState } from "react";
import { LegalLayout } from "@/components/marketing/LegalLayout";

export default function ContactPage() {
  const [message, setMessage] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFlash(null);
    if (!message.trim()) return;
    setSending(true);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, page: "/contact" }),
    });
    setSending(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      setFlash({ ok: false, msg: json?.error?.message ?? "Failed to send" });
      return;
    }
    setFlash({ ok: true, msg: "Message sent — we'll get back to you." });
    setMessage("");
  }

  const cards = [
    { label: "General", subject: "General enquiry", desc: "Questions about NukeAPI, integrations, or the product" },
    { label: "Billing", subject: "Billing support", desc: "Subscriptions, invoices, refunds, plan changes" },
    { label: "Privacy & Legal", subject: "Privacy request", desc: "Data access, deletion, DPA requests, legal matters" },
    { label: "Bug Report", subject: "Bug report", desc: "Something not working? Tell us and we will fix it" },
    { label: "Enterprise", subject: "Enterprise plan", desc: "Custom connectors, SLA, unlimited volume, white-label" },
  ];

  return (
    <LegalLayout title="Contact" updated="2026-07-18">
      <p>We respond to every message personally, usually within 24 hours.</p>
      {flash && (
        <div className={flash.ok ? "flash flash-ok" : "flash flash-error"} style={{ marginTop: 16 }}>
          {flash.msg}
        </div>
      )}
      <form onSubmit={submit} style={{ marginTop: 16 }}>
        <textarea
          className="textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          style={{ minHeight: 140 }}
        />
        <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={sending}>
          {sending ? "Sending…" : "Send message"}
        </button>
      </form>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Or email us directly</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        {cards.map(({ label, subject, desc }) => (
          <a
            key={label}
            href={`mailto:hello@nukeapi.dev?subject=${encodeURIComponent(subject)}`}
            style={{ textDecoration: "none" }}
          >
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 12, color: "var(--lime)" }}>hello@nukeapi.dev →</div>
              </div>
              <div style={{ fontSize: 13, color: "var(--t2)" }}>{desc}</div>
            </div>
          </a>
        ))}
      </div>
    </LegalLayout>
  );
}
