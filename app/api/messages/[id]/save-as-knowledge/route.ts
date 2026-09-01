import { NextResponse } from "next/server";
import { embedText } from "@/lib/ai/client";
import { normalizeSavedAnswer, slugify } from "@/lib/processing/knowledge";
import { requireUser } from "@/lib/supabase/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const { data: message, error } = await supabase.from("messages").select("*").eq("id", id).eq("role", "assistant").single();
  if (error) return NextResponse.json({ error: "Không tìm thấy câu trả lời để lưu." }, { status: 404 });

  try {
    const normalized = await normalizeSavedAnswer(message.content, message.citations || []);
    const vector = await embedText(`${normalized.title}\n${normalized.short_summary}\n${normalized.body}`);
    const { data: spaceId, error: spaceError } = await supabase.rpc("ensure_default_space");
    if (spaceError) return NextResponse.json({ error: spaceError.message }, { status: 500 });

    const { data: similar } = await supabase.rpc("match_knowledge_items", { query_embedding: vector, match_count: 1 });
    const target = Array.isArray(similar) && similar[0]?.similarity > 0.88 ? similar[0] : null;

    const payload = {
      title: normalized.title,
      slug: slugify(normalized.title),
      item_type: normalized.item_type,
      short_summary: normalized.short_summary,
      body: normalized.body,
      confidence: normalized.confidence,
      status: normalized.confidence < 0.5 ? "needs_review" : "active",
      created_by: "saved_answer",
      embedding: vector,
      metadata: { source_message_id: id, citations: message.citations || [] }
    };

    let knowledgeId: string;
    if (target) {
      const { data: before } = await supabase.from("knowledge_items").select("*").eq("id", target.id).single();
      const { data: updated, error: updateError } = await supabase
        .from("knowledge_items")
        .update(payload)
        .eq("id", target.id)
        .select("id")
        .single();
      if (updateError) throw updateError;
      knowledgeId = updated.id;
      await supabase.from("knowledge_history").insert({
        knowledge_item_id: knowledgeId,
        user_id: user.id,
        change_type: "saved_answer_update",
        before_data: before,
        after_data: payload,
        reason: "Câu trả lời đã lưu trùng với một tri thức hiện có."
      });
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("knowledge_items")
        .insert({ ...payload, user_id: user.id, space_id: spaceId })
        .select("id")
        .single();
      if (insertError) throw insertError;
      knowledgeId = inserted.id;
    }

    const citations = (message.citations || []) as Array<{ document_id: string; chunk_id: string | null; excerpt: string }>;
    const sourceRows = citations.map((citation) => ({
      knowledge_item_id: knowledgeId,
      document_id: citation.document_id,
      chunk_id: citation.chunk_id,
      quote_text: citation.excerpt,
      relevance: 0.8
    }));
    if (sourceRows.length) {
      await supabase.from("knowledge_sources").upsert(sourceRows, { onConflict: "knowledge_item_id,document_id,chunk_id" });
    }
    return NextResponse.json({ knowledge_id: knowledgeId });
  } catch (saveError) {
    return NextResponse.json({ error: saveError instanceof Error ? saveError.message : "Không lưu được tri thức." }, { status: 422 });
  }
}
