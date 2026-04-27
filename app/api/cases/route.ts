import { NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  let supabase: ReturnType<typeof serviceSupabase>;
  try {
    supabase = serviceSupabase();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  // Real-case-mode stub — blank owner/pet seeded, intake agent will populate via WhatsApp
  const { data: owner, error: ownerErr } = await supabase
    .from("owners")
    .insert({ full_name: "Pending Intake", locale: "en", residence_country: "AE", destination_country: "GB" })
    .select("id").single();
  if (ownerErr) return NextResponse.json({ error: ownerErr.message }, { status: 500 });

  const { data: pet, error: petErr } = await supabase
    .from("pets")
    .insert({ owner_id: owner!.id, name: "Pending", species: "dog" })
    .select("id").single();
  if (petErr) return NextResponse.json({ error: petErr.message }, { status: 500 });

  const caseNumber = `VTR-${Date.now().toString(36).toUpperCase()}`;
  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .insert({
      owner_id: owner!.id,
      pet_id: pet!.id,
      case_number: caseNumber,
      origin_country: "AE",
      destination_country: "GB",
      state: "draft",
      demo_mode: false,
    })
    .select("id").single();
  if (caseErr) return NextResponse.json({ error: caseErr.message }, { status: 500 });

  return NextResponse.json({ case_id: caseRow!.id, case_number: caseNumber });
}
