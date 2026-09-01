import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ document_id: string }> }) {
  const { document_id } = await params;
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const { data, error } = await supabase
    .from("processing_jobs")
    .select("*")
    .eq("document_id", document_id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data });
}
