import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const { data, error } = await supabase
    .from("knowledge_items")
    .select("*, knowledge_sources(id,quote_text,relevance,document_id,chunk_id,source_documents(id,title,file_name,source_url)), knowledge_links!knowledge_links_from_item_id_fkey(id,to_item_id,relation_type,explanation,confidence)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) return NextResponse.json({ error: "Không tìm thấy tri thức." }, { status: 404 });
  return NextResponse.json({ knowledge: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const body = await request.json().catch(() => null);
  const allowed = ["title", "short_summary", "body", "item_type", "confidence", "status"] as const;
  const changes: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body?.[key] !== undefined) changes[key] = body[key];
  }
  if (!Object.keys(changes).length) return NextResponse.json({ error: "Chưa có thay đổi nào." }, { status: 400 });

  const { data: before } = await supabase.from("knowledge_items").select("*").eq("id", id).single();
  const { data, error } = await supabase.from("knowledge_items").update(changes).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("knowledge_history").insert({
    knowledge_item_id: id,
    user_id: user.id,
    change_type: "user_edit",
    before_data: before,
    after_data: data,
    reason: "Chỉnh sửa thủ công"
  });
  return NextResponse.json({ knowledge: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const { error } = await supabase.from("knowledge_items").update({ deleted_at: new Date().toISOString(), status: "archived" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
