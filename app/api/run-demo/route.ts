import { NextResponse } from "next/server";
import { SUPABASE_URL } from "@/lib/supabase";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/demo-spawn-case`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: "demo_spawn_failed", detail: String(e) },
      { status: 500 },
    );
  }
}
