import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const { data, error } = await supabase
    .from("conversations")
    .select("id,title,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data });
}
