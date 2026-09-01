import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/processing/knowledge";
import { requireUser } from "@/lib/supabase/auth";
import type { AnswerMode } from "@/lib/ai/router";

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const body = await request.json().catch(() => null);
  const question = String(body?.question || "").trim();
  if (question.length < 2) return NextResponse.json({ error: "Bạn cần nhập câu hỏi." }, { status: 400 });
  const requestedMode = String(body?.mode || "standard");
  const mode: AnswerMode = requestedMode === "fast" || requestedMode === "deep" ? requestedMode : "standard";

  const { data: spaceId, error: spaceError } = await supabase.rpc("ensure_default_space");
  if (spaceError) return NextResponse.json({ error: spaceError.message }, { status: 500 });

  let conversationId = body?.conversation_id || null;
  if (!conversationId) {
    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, space_id: spaceId, title: question.slice(0, 80) })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    conversationId = conversation.id;
  }

  const { error: userMessageError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "user",
    content: question
  });
  if (userMessageError) return NextResponse.json({ error: userMessageError.message }, { status: 500 });

  try {
    const result = await answerQuestion(supabase, question, mode);
    const messageContent = [
      result.direct_answer,
      ...(result.sections || []).map((section) => `${section.heading}\n${section.content}`),
      result.practical_conclusion ? `Kết luận thực hành\n${result.practical_conclusion}` : ""
    ]
      .filter(Boolean)
      .join("\n\n");
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        content: messageContent,
        citations: result.citations,
        metadata: {
          confidence: result.confidence,
          structured_answer: result,
          answer_mode: mode,
          insufficient_evidence: result.insufficient_evidence
        }
      })
      .select("id")
      .single();
    if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 });
    return NextResponse.json({ conversation_id: conversationId, message_id: message.id, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chưa thể trả lời lúc này. Hãy thử lại sau." },
      { status: 422 }
    );
  }
}
