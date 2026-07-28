"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/db/browser";

export default function SignupPage() {
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const params = new URLSearchParams(window.location.search);
    const trialPlan = params.get("plan");
    const isTrial = params.get("trial") === "true";

    // Persist trial intent across email confirmation redirect
    if (trialPlan && isTrial) {
      localStorage.setItem("pending_trial", trialPlan);
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard` },
    });
    setLoading(false);
    if (error) {
      setFlash({ ok: false, msg: error.message });
      return;
    }
    if (data.session) {
      const effectivePlan = trialPlan ?? localStorage.getItem("pending_trial");
      const effectiveTrial = isTrial || !!localStorage.getItem("pending_trial");
      localStorage.removeItem("pending_trial");
      if (effectivePlan && effectiveTrial) {
        // Logged-in user — start trial immediately
        try {
          const res = await fetch("/api/v1/trial/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: effectivePlan }),
          });
          const result = await res.json();
          if (result.success) {
            window.location.assign("/settings");
            return;
          }
        } catch {
          // Fall through to dashboard
        }
      }
      window.location.assign("/dashboard");
    } else {
      setFlash({
        ok: true,
        msg: "Account created. Check your email to confirm your address, then sign in.",
      });
    }
  }

  return (
    <form className="card" style={{ width: "100%", maxWidth: 400 }} onSubmit={onSubmit}>
      <h1 style={{ fontSize: 26, letterSpacing: "-1.5px", marginBottom: 6 }}>Create account</h1>
      <p style={{ marginBottom: 20 }}>Start with the free Sandbox plan — 20 deletions/month.</p>
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
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters"
        style={{ marginBottom: 18 }}
      />
      <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Creating…" : "Create account"}
      </button>
      <p style={{ marginTop: 18, fontSize: 14, textAlign: "center" }}>
        Already have one?{" "}
        <Link href="/login" style={{ color: "var(--lime)" }}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
