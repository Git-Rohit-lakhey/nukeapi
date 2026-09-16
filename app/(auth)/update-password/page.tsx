"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/db/browser";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFlash(null);
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setFlash({ ok: false, msg: error.message });
      return;
    }
    setFlash({ ok: true, msg: "Password updated. Redirecting…" });
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 800);
  }

  return (
    <form className="card" style={{ width: "100%", maxWidth: 400 }} onSubmit={onSubmit}>
      <h1 style={{ fontSize: 26, letterSpacing: "-1.5px", marginBottom: 6 }}>Set new password</h1>
      <p style={{ marginBottom: 20 }}>Choose a new password for your account.</p>
      {flash && (
        <div className={flash.ok ? "flash flash-ok" : "flash flash-error"}>{flash.msg}</div>
      )}
      <label className="label">New password</label>
      <input
        className="input"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters"
        style={{ marginBottom: 18 }}
      />
      <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
