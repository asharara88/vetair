// Server-only Supabase factory. Do NOT import from client components — uses next/headers.
import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase";

interface CookieItem {
  name: string;
  value: string;
  options?: CookieOptions;
}

export async function serverSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items: CookieItem[]) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // server components can't set cookies; ignore
        }
      },
    },
  });
}

// Service-role client for API routes / webhooks / agent runtime.
// Bypasses RLS — never call from client components or pass into rendered output.
export function serviceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
