import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const { data: source, error } = await supabase
    .from("source_documents")
    .select("*, document_chunks(id,chunk_index,content,token_count), knowledge_sources(knowledge_item_id, quote_text, knowledge_items(id,title,item_type,short_summary))")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) return NextResponse.json({ error: "Không tìm thấy nguồn." }, { status: 404 });
  return NextResponse.json({ source });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const { error } = await supabase
    .from("source_documents")
    .update({ deleted_at: new Date().toISOString(), status: "failed" })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
