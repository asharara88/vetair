// Client-safe Supabase exports. Importable from both server and client components.
// For serverSupabase() (uses next/headers), see lib/supabase-server.ts.
import { createBrowserClient } from "@supabase/ssr";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://yydnaisrgwiuuiespagi.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function browserSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export const LOGO_LIGHT =
  `${SUPABASE_URL}/storage/v1/object/public/vetair%20logo/VETAIR/light%20theme%20logo.png`;
export const LOGO_DARK =
  `${SUPABASE_URL}/storage/v1/object/public/vetair%20logo/VETAIR/dark%20theme%20logo.png`;
