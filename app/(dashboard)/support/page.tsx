"use client";

import { useState } from "react";

export default function SupportPage() {
  const [message, setMessage] = useState("");
  const [page, setPage] = useState("");
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
      body: JSON.stringify({ message, page }),
    });
    setSending(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      setFlash({ ok: false, msg: json?.error?.message ?? "Failed to send" });
      return;
    }
    setFlash({ ok: true, msg: "Thanks — we'll take a look." });
    setMessage("");
  }

  return (
    <div>
      <p className="eyebrow">support</p>
      <h1 style={{ fontSize: 30 }}>Feedback & bugs</h1>
      <p style={{ maxWidth: 560 }}>Found a bug or have a feature request? Tell us.</p>
      {flash && (
        <div className={flash.ok ? "flash flash-ok" : "flash flash-error"} style={{ marginTop: 16 }}>
          {flash.msg}
        </div>
      )}
      <form className="card" style={{ marginTop: 16, maxWidth: 560 }} onSubmit={submit}>
        <label className="label">Page (optional)</label>
        <input
          className="input"
          value={page}
          onChange={(e) => setPage(e.target.value)}
          placeholder="/dashboard"
          style={{ marginBottom: 12 }}
        />
        <label className="label">Message</label>
        <textarea
          className="textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's wrong or what would you like?"
          style={{ marginBottom: 16 }}
        />
        <button className="btn btn-primary" disabled={sending}>
          {sending ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </div>
  );
}
