import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SessionUser } from "@/types/api";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon) {
  // Don't crash at import time in environments without env (tests). The
  // functions below will throw a clear error when actually called.
  console.warn("[supabase] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY not set");
}

let _admin: SupabaseClient | null = null;

/** Service-role client — server only, never exposed to the client. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!url || !serviceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  if (!_admin) {
    _admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

/** Cookies-based server client for session-authenticated routes. */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  if (!url || !anon) {
    throw new Error("Supabase env not configured");
  }
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>,
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll can throw in read-only contexts (e.g. Server Components);
          // middleware refreshes the session separately.
        }
      },
    },
  });
}

/** Resolve the current authenticated user from the session cookie. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}
