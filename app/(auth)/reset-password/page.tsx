"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/db/browser";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFlash(null);
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/update-password`,
    });
    setLoading(false);
    if (error) {
      setFlash({ ok: false, msg: error.message });
      return;
    }
    setFlash({ ok: true, msg: "If that email exists, a reset link is on its way." });
  }

  return (
    <form className="card" style={{ width: "100%", maxWidth: 400 }} onSubmit={onSubmit}>
      <h1 style={{ fontSize: 26, letterSpacing: "-1.5px", marginBottom: 6 }}>Reset password</h1>
      <p style={{ marginBottom: 20 }}>We&apos;ll email you a secure reset link.</p>
      {flash && (
        <div className={flash.ok ? "flash flash-ok" : "flash flash-error"}>{flash.msg}</div>
      )}
      <label className="label">Email</label>
      <input
        className="input"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        style={{ marginBottom: 18 }}
      />
      <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Sending…" : "Send reset link"}
      </button>
      <p style={{ marginTop: 18, fontSize: 14, textAlign: "center" }}>
        <Link href="/login" style={{ color: "var(--lime)" }}>
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
