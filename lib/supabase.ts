import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://yydnaisrgwiuuiespagi.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function browserSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export async function serverSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // server components can't set cookies; ignore
        }
      },
    },
  });
}

export const LOGO_LIGHT =
  `${SUPABASE_URL}/storage/v1/object/public/vetair%20logo/VETAIR/light%20theme%20logo.png`;
export const LOGO_DARK =
  `${SUPABASE_URL}/storage/v1/object/public/vetair%20logo/VETAIR/dark%20theme%20logo.png`;
