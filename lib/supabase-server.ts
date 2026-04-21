// Server-only Supabase factory. Do NOT import from client components — uses next/headers.
import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
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
