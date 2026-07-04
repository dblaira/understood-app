import { NextRequest } from "next/server";
import { createClient as createBrowserClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "./server";

/**
 * Authenticate a request via Bearer JWT (iOS app) or cookies (web app).
 * Returns the authenticated Supabase client and user, or null user if unauthenticated.
 */
export async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    return { user, supabase };
  }

  // Cookie-based auth (web) — Next.js 15 requires await
  const supabase = await createCookieClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}
