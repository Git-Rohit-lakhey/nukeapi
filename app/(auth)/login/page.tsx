"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/db/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFlash(null);
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setFlash({ ok: false, msg: error.message });
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="card" style={{ width: "100%", maxWidth: 400 }} onSubmit={onSubmit}>
      <h1 style={{ fontSize: 26, letterSpacing: "-1.5px", marginBottom: 6 }}>Sign in</h1>
      <p style={{ marginBottom: 20 }}>Welcome back. Access your deletion dashboard.</p>
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
        style={{ marginBottom: 14 }}
      />
      <label className="label">Password</label>
      <input
        className="input"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        style={{ marginBottom: 8 }}
      />
      <div style={{ textAlign: "right", marginBottom: 16 }}>
        <Link href="/reset-password" style={{ fontSize: 13, color: "var(--lime)" }}>
          Forgot password?
        </Link>
      </div>
      <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p style={{ marginTop: 18, fontSize: 14, textAlign: "center" }}>
        No account?{" "}
        <Link href="/signup" style={{ color: "var(--lime)" }}>
          Create one
        </Link>
      </p>
    </form>
  );
}
