import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/processing/knowledge";
import { requireUser } from "@/lib/supabase/auth";
import { detectQueryIntent, type AnswerMode } from "@/lib/ai/router";
import type { StructuredAnswerPayload } from "@/lib/types";

type SupabaseClient = Awaited<ReturnType<typeof requireUser>>["supabase"];

function cleanDocumentSubject(value: string) {
  return value
    .replace(/[?!.]+$/g, "")
    .replace(/\b(văn bản|tài liệu)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStructureRequest(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  const direct = normalized.match(/^(.+?)(?:\s+có)?\s+bao\s+nhiêu\s+(điều|chương)\b/i);
  if (direct) return { subject: cleanDocumentSubject(direct[1]), unit: direct[2].toLowerCase() as "điều" | "chương" };

  const inverse = normalized.match(/bao\s+nhiêu\s+(điều|chương)\b.*?(?:trong|của)\s+(.+)$/i);
  if (inverse) return { subject: cleanDocumentSubject(inverse[2]), unit: inverse[1].toLowerCase() as "điều" | "chương" };

  return null;
}

function romanToNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let previous = 0;
  for (const char of value.toUpperCase().split("").reverse()) {
    const current = map[char] || 0;
    total += current < previous ? -current : current;
    previous = Math.max(previous, current);
  }
  return total;
}

async function answerDocumentStructureQuestion(
  supabase: SupabaseClient,
  question: string
): Promise<StructuredAnswerPayload | null> {
  const request = extractStructureRequest(question);
  if (!request || request.subject.length < 3) return null;

  const safeSubject = request.subject.replace(/[%_,]/g, " ").trim();
  const { data, error } = await supabase
    .from("source_documents")
    .select("id,title,file_name,source_url,raw_text,status,created_at")
    .is("deleted_at", null)
    .or(`title.ilike.%${safeSubject}%,file_name.ilike.%${safeSubject}%`)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error || !data?.length) return null;

  const readyDocs = data.filter((doc) => doc.status === "ready" && typeof doc.raw_text === "string" && doc.raw_text.trim());
  const docs = readyDocs.length ? readyDocs : data.filter((doc) => typeof doc.raw_text === "string" && doc.raw_text.trim());
  if (!docs.length) return null;

  const combined = docs.map((doc) => String(doc.raw_text || "")).join("\n");
  const documentTitle = docs[0].title || docs[0].file_name || docs[0].source_url || request.subject;

  if (request.unit === "điều") {
    const numbers = Array.from(combined.matchAll(/(?:^|\n)\s*Điều\s+(\d+)\s*(?:[.:\-]|\b)/gim))
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value) && value > 0 && value < 10000);
    const unique = Array.from(new Set(numbers)).sort((a, b) => a - b);
    if (!unique.length) return null;
    const max = unique[unique.length - 1];
    const completeSequence = unique.length === max && unique[0] === 1;

    return {
      direct_answer: completeSequence
        ? `${documentTitle} có ${max} Điều.`
        : `Trong tài liệu ${documentTitle}, BRAIN nhận diện ${unique.length} Điều, số Điều lớn nhất là Điều ${max}.`,
      sections: [],
      practical_conclusion: completeSequence ? "" : "Tài liệu có thể thiếu phần hoặc cách đánh số không liên tục; nên kiểm tra bản gốc nếu cần xác nhận tuyệt đối.",
      citations: [],
      confidence: completeSequence ? 0.99 : 0.82,
      insufficient_evidence: false
    };
  }

  const chapters = Array.from(combined.matchAll(/(?:^|\n)\s*Chương\s+([IVXLCDM]+|\d+)\b/gim))
    .map((match) => romanToNumber(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 1000);
  const unique = Array.from(new Set(chapters)).sort((a, b) => a - b);
  if (!unique.length) return null;
  const max = unique[unique.length - 1];

  return {
    direct_answer: `${documentTitle} có ${unique.length} Chương${unique.length === max ? `, từ Chương I đến Chương ${max}` : ""}.`,
    sections: [],
    practical_conclusion: "",
    citations: [],
    confidence: 0.98,
    insufficient_evidence: false
  };
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const body = await request.json().catch(() => null);
  const question = String(body?.question || "").trim();
  if (question.length < 2) return NextResponse.json({ error: "Bạn cần nhập câu hỏi." }, { status: 400 });
  const requestedMode = String(body?.mode || "standard");
  const mode: AnswerMode = requestedMode === "fast" || requestedMode === "deep" ? requestedMode : "standard";
  const intent = detectQueryIntent(question);
  const effectiveMode: AnswerMode = mode === "deep" && intent === "lookup" && question.length <= 140 ? "fast" : mode;

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
    const deterministicResult = await answerDocumentStructureQuestion(supabase, question);
    const result = deterministicResult || (await answerQuestion(supabase, question, effectiveMode));
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
          requested_answer_mode: mode,
          answer_mode: deterministicResult ? "direct" : effectiveMode,
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
