import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const { data, error } = await supabase
    .from("source_documents")
    .select("id,source_type,file_name,source_url,title,status,error_message,created_at,updated_at,metadata")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: data });
}
