"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/db/browser";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button className="btn btn-sm" onClick={signOut} style={{ width: "100%" }}>
      Sign out
    </button>
  );
}
