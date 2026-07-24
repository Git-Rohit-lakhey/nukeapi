import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase";

/**
 * Exchanges the Supabase auth code (from confirmation / password-reset links)
 * for a session cookie, then redirects to `next`.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
