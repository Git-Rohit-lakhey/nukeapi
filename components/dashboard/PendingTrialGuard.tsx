"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Checks localStorage for a pending trial (set by signup/login pages)
 * and auto-starts it. Runs once on mount.
 */
export function PendingTrialGuard() {
  const router = useRouter();

  useEffect(() => {
    const plan = localStorage.getItem("pending_trial");
    if (!plan) return;
    localStorage.removeItem("pending_trial");

    fetch("/api/v1/trial/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.success) {
          window.location.assign("/settings");
        }
      })
      .catch(() => {
        // Ignore — user can start trial manually from settings
      });
  }, [router]);

  return null;
}
