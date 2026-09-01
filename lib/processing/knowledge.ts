import { analyzerSchema, answerSchema, reconcilerSchema, savedKnowledgeSchema } from "@/lib/ai/schemas";
import { embedText, runAiJson } from "@/lib/ai/client";
import {
  chooseAnswerTask,
  detectLegalQuery,
  detectQueryIntent,
  getRetrievalDepth,
  type AnswerMode,
  type QueryIntent
} from "@/lib/ai/router";
import { cleanEvidenceText, excerpt, scoreLegalEvidence } from "@/lib/processing/text";
import type { Citation, DbClient, StructuredAnswerPayload } from "@/lib/types";

type MatchChunk = {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
  metadata: {
    chunk_index?: number;
    [key: string]: unknown;
  };
};

type NeighborChunk = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
};

type SourceDocumentLite = {
  id: string;
  title: string | null;
  file_name: string | null;
  source_url: string | null;
};

type EvidenceChunk = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  excerpt: string;
  similarity: number;
  chunk_index: number | null;
  rerank_score: number;
};

function insufficientAnswer(message: string): StructuredAnswerPayload {
  return {
    direct_answer: message,
    sections: [],
    practical_conclusion: "Hãy thêm hoặc xử lý lại tài liệu nguồn liên quan trước khi hỏi tiếp.",
    citations: [],
    confidence: 0.2,
    insufficient_evidence: true
  };
}

function dedupeEvidence(chunks: EvidenceChunk[]) {
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    const key = `${chunk.document_id}:${chunk.chunk_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function citationSourceKey(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sanitizePublicText(value: string) {
  return value
    .replace(/(?:document_id|chunk_id)\s*[:=]?\s*`?[0-9a-f-]{8,}`?/gi, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\bevidence(?:_chunks)?\b/gi, "nguồn trích dẫn")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function dedupeCitations(citations: Citation[], fallbackEvidence: EvidenceChunk[], maxSources = 6) {
  const evidenceByKey = new Map(fallbackEvidence.map((item) => [`${item.document_id}:${item.chunk_id}`, item]));
  const seenSources = new Set<string>();
  const cleaned: Citation[] = [];

  for (const citation of citations) {
    const evidenceKey = `${citation.document_id}:${citation.chunk_id || ""}`;
    const fallback = evidenceByKey.get(evidenceKey);
    const title = citation.document_title || fallback?.document_title || "Nguồn";
    const sourceKey = citationSourceKey(title) || citation.document_id;
    if (seenSources.has(sourceKey)) continue;
    seenSources.add(sourceKey);
    cleaned.push({
      claim: citation.claim ? sanitizePublicText(citation.claim) : undefined,
      document_id: citation.document_id,
      document_title: sanitizePublicText(title),
      section: citation.section ? sanitizePublicText(citation.section) : undefined,
      chunk_id: citation.chunk_id,
      excerpt: excerpt(sanitizePublicText(citation.excerpt || fallback?.excerpt || ""), 420)
    });
  }

  if (cleaned.length) return cleaned.slice(0, maxSources);

  const fallbackSeen = new Set<string>();
  const fallbackCitations: Citation[] = [];
  for (const item of fallbackEvidence) {
    const sourceKey = citationSourceKey(item.document_title) || item.document_id;
    if (fallbackSeen.has(sourceKey)) continue;
    fallbackSeen.add(sourceKey);
    fallbackCitations.push({
      document_id: item.document_id,
      document_title: sanitizePublicText(item.document_title),
      section: "Căn cứ",
      chunk_id: item.chunk_id,
      excerpt: excerpt(sanitizePublicText(item.excerpt), 420)
    });
    if (fallbackCitations.length >= maxSources) break;
  }
  return fallbackCitations;
}

const analyzerSystem = `You are BRAIN Document Analyzer.
Use only supplied source. Do not invent.
Extract meaningful concepts, entities, dates, events, rules and candidate knowledge.
Every candidate must reference supporting chunk IDs.
Report internal conflicts.
Return validated JSON only with this exact shape:
{
  "candidates": [
    {
      "title": "string",
      "item_type": "concept|person|organization|event|timeline|rule|decision|case|summary|insight|other",
      "short_summary": "string",
      "body": "string",
      "confidence": 0.75,
      "supporting_chunk_ids": ["chunk id from input"],
      "entities": ["string"],
      "dates": ["string"],
      "relation_hints": []
    }
  ],
  "internal_conflicts": []
}`;

const reconcilerSystem = `You are BRAIN Knowledge Reconciler.
Choose exactly one: CREATE, UPDATE, NO_CHANGE or CONFLICT.
Never remove evidence.
Never silently replace conflicting claims.
Merge only genuinely identical concepts.
Return validated JSON only with this exact shape:
{
  "action": "CREATE|UPDATE|NO_CHANGE|CONFLICT",
  "target_item_id": null,
  "title": "string",
  "short_summary": "string",
  "body": "string",
  "confidence": 0.75,
  "reason": "string",
  "relation_type": "related_to"
}`;

const answerSystemBase = `Bạn là BRAIN — trợ lý tri thức cá nhân.

Nguyên tắc bất biến:
1. Trả lời đúng câu hỏi, không phô diễn kiến thức ngoài nhu cầu.
2. Chỉ dùng evidence được cung cấp khi trả lời về kho tri thức.
3. Không bịa điều/khoản, ngoại lệ, số liệu hoặc kết luận.
4. Nếu thiếu căn cứ, nói rõ thiếu gì.
5. Không bao giờ hiển thị document_id, chunk_id, retrieval score, tên biến, raw JSON hay thuật ngữ nội bộ như "evidence" cho người dùng.
6. Citation chỉ dùng ID hợp lệ trong JSON đầu ra; phần văn bản hiển thị cho người dùng chỉ dùng tên tài liệu và nội dung dễ hiểu.
7. Không lặp lại cùng một ý ở direct_answer, sections và practical_conclusion.
8. Không tạo mục chỉ để đủ khuôn. Mục nào không cần thì bỏ.

Return JSON only theo schema đã yêu cầu.`;

function answerInstructions(mode: AnswerMode, intent: QueryIntent) {
  const modeRule =
    mode === "fast"
      ? `CHẾ ĐỘ NHANH: trả lời cực gọn, ưu tiên 2–6 câu hoặc tối đa 3 bullet. Thông thường sections = [] và practical_conclusion = "". Chỉ thêm một section nếu thật sự cần để tránh hiểu sai.`
      : mode === "deep"
        ? `CHẾ ĐỘ CHUYÊN SÂU: phân tích có cấu trúc, có thể dùng nhiều section, nêu căn cứ, xung đột, giới hạn và kết luận thực hành khi phù hợp. Không kéo dài vô ích.`
        : `CHẾ ĐỘ CHUẨN: trả lời đầy đủ nhưng tiết chế. Thường 2–4 section tối đa. Chỉ dùng tiêu mục liên quan trực tiếp đến câu hỏi.`;

  const intentRule: Record<QueryIntent, string> = {
    source_list: `Ý ĐỊNH: liệt kê nguồn. Chỉ liệt kê tên nguồn/tài liệu, số lượng và ghi chú trùng lặp nếu có. Không phân tích nội dung pháp lý, không trình bày document_id/chunk_id, không diễn giải các điều luật nếu người dùng không hỏi.`,
    definition: `Ý ĐỊNH: định nghĩa. Nêu định nghĩa trực tiếp trước, sau đó chỉ giải thích bản chất/căn cứ cần thiết. Không tự mở rộng thành bài nghiên cứu.`,
    lookup: `Ý ĐỊNH: tra cứu. Trả đúng thông tin được hỏi; thêm căn cứ ngắn khi hữu ích.`,
    compare: `Ý ĐỊNH: so sánh. Nhóm theo các tiêu chí khác biệt quan trọng; ưu tiên bảng hoặc bullet ngắn nếu nội dung cho phép.`,
    analysis: `Ý ĐỊNH: phân tích/tư vấn. Làm rõ bản chất, căn cứ, rủi ro/ngoại lệ và kết luận thực hành khi evidence hỗ trợ.`
  };

  return `${answerSystemBase}\n\n${modeRule}\n\n${intentRule[intent]}`;
}


export function slugify(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "knowledge";
}

async function getDefaultSpace(supabase: DbClient) {
  const { data, error } = await supabase.rpc("ensure_default_space");
  if (error) throw error;
  return data as string;
}

export async function analyzeDocument(supabase: DbClient, documentId: string) {
  const { data: document, error: documentError } = await supabase
    .from("source_documents")
    .select("id,title,raw_text,user_id")
    .eq("id", documentId)
    .single();
  if (documentError) throw documentError;

  const { data: chunks, error: chunksError } = await supabase
    .from("document_chunks")
    .select("id,chunk_index,content")
    .eq("document_id", documentId)
    .order("chunk_index");
  if (chunksError) throw chunksError;

  const compactChunks = (chunks || []).map((chunk) => ({
    id: chunk.id,
    chunk_index: chunk.chunk_index,
    excerpt: excerpt(chunk.content, 1800)
  }));

  const analysis = await runAiJson(
    "DOCUMENT_ANALYZE",
    [
      { role: "system", content: analyzerSystem },
      {
        role: "user",
        content: JSON.stringify({
          document_id: document.id,
          title: document.title,
          chunks: compactChunks
        })
      }
    ],
    analyzerSchema
  );

  const spaceId = await getDefaultSpace(supabase);

  for (const candidate of analysis.candidates) {
    const vector = await embedText(`${candidate.title}\n${candidate.short_summary}\n${candidate.body}`);
    const { data: similar } = await supabase.rpc("match_knowledge_items", {
      query_embedding: vector,
      match_count: 5
    });

    const reconciliation = await runAiJson(
      "KNOWLEDGE_RECONCILE",
      [
        { role: "system", content: reconcilerSystem },
        {
          role: "user",
          content: JSON.stringify({
            candidate,
            similar_existing_items: similar || []
          })
        }
      ],
      reconcilerSchema
    );

    if (reconciliation.action === "NO_CHANGE" && reconciliation.target_item_id) {
      await attachSources(supabase, reconciliation.target_item_id, documentId, candidate.supporting_chunk_ids);
      continue;
    }

    if ((reconciliation.action === "UPDATE" || reconciliation.action === "CONFLICT") && reconciliation.target_item_id) {
      const { data: before } = await supabase
        .from("knowledge_items")
        .select("*")
        .eq("id", reconciliation.target_item_id)
        .single();

      const nextStatus = reconciliation.action === "CONFLICT" ? "needs_review" : "active";
      const { error: updateError } = await supabase
        .from("knowledge_items")
        .update({
          title: reconciliation.title,
          short_summary: reconciliation.short_summary,
          body: reconciliation.body,
          confidence: reconciliation.confidence,
          status: nextStatus,
          embedding: vector,
          metadata: { ...(before?.metadata || {}), last_reconciliation_reason: reconciliation.reason }
        })
        .eq("id", reconciliation.target_item_id);
      if (updateError) throw updateError;

      await supabase.from("knowledge_history").insert({
        knowledge_item_id: reconciliation.target_item_id,
        user_id: before?.user_id,
        change_type: reconciliation.action.toLowerCase(),
        before_data: before,
        after_data: {
          title: reconciliation.title,
          short_summary: reconciliation.short_summary,
          body: reconciliation.body,
          confidence: reconciliation.confidence,
          status: nextStatus
        },
        reason: reconciliation.reason
      });
      await attachSources(supabase, reconciliation.target_item_id, documentId, candidate.supporting_chunk_ids);
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("knowledge_items")
      .insert({
        space_id: spaceId,
        user_id: document.user_id,
        title: candidate.title,
        slug: slugify(candidate.title),
        item_type: candidate.item_type,
        short_summary: candidate.short_summary,
        body: candidate.body,
        confidence: candidate.confidence,
        status: candidate.confidence < 0.5 ? "needs_review" : "active",
        created_by: "ai",
        embedding: vector,
        metadata: {
          entities: candidate.entities,
          dates: candidate.dates,
          internal_conflicts: analysis.internal_conflicts
        }
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    await attachSources(supabase, inserted.id, documentId, candidate.supporting_chunk_ids);
  }
}

async function attachSources(supabase: DbClient, knowledgeItemId: string, documentId: string, chunkIds: string[]) {
  if (chunkIds.length === 0) return;
  const { data: chunks, error } = await supabase.from("document_chunks").select("id,content").in("id", chunkIds);
  if (error) throw error;
  const rows = (chunks || []).map((chunk) => ({
    knowledge_item_id: knowledgeItemId,
    document_id: documentId,
    chunk_id: chunk.id,
    quote_text: excerpt(chunk.content),
    relevance: 0.85
  }));
  if (rows.length) {
    const { error: sourceError } = await supabase.from("knowledge_sources").upsert(rows, {
      onConflict: "knowledge_item_id,document_id,chunk_id"
    });
    if (sourceError) throw sourceError;
  }
}

function normalizeSourceLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function listSourcesAnswer(supabase: DbClient): Promise<StructuredAnswerPayload> {
  const { data, error } = await supabase
    .from("source_documents")
    .select("id,title,file_name,source_url,status,created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const docs = (data || []) as Array<SourceDocumentLite & { status?: string; created_at?: string }>;
  if (!docs.length) return insufficientAnswer("Kho của bạn chưa có tài liệu nguồn nào.");

  const groups = new Map<string, { title: string; docs: typeof docs }>();
  for (const doc of docs) {
    const title = doc.title || doc.file_name || doc.source_url || "Nguồn chưa đặt tên";
    const key = normalizeSourceLabel(title);
    const current = groups.get(key);
    if (current) current.docs.push(doc);
    else groups.set(key, { title, docs: [doc] });
  }

  const grouped = Array.from(groups.values());
  const lines = grouped.map((group, index) =>
    `${index + 1}. ${group.title}${group.docs.length > 1 ? ` — ${group.docs.length} bản ghi` : ""}`
  );
  const duplicateGroups = grouped.filter((group) => group.docs.length > 1);
  const readyCount = docs.filter((doc) => doc.status === "ready").length;

  return {
    direct_answer: `Kho hiện có ${docs.length} bản ghi nguồn, tương ứng ${grouped.length} tên tài liệu.`,
    sections: [{ heading: "Tài liệu nguồn", content: lines.map((line) => `- ${line}`).join("\n") }],
    practical_conclusion: duplicateGroups.length
      ? `Có ${duplicateGroups.length} nhóm tên tài liệu bị lặp. Nên kiểm tra để xác định đó là bản sao hay các phiên bản khác nhau trước khi hợp nhất.`
      : readyCount < docs.length
        ? `${readyCount}/${docs.length} nguồn đã xử lý xong.`
        : "",
    citations: [],
    confidence: 1,
    insufficient_evidence: false
  };
}

export async function answerQuestion(supabase: DbClient, question: string, mode: AnswerMode = "standard") {
  const intent = detectQueryIntent(question);
  if (intent === "source_list") return listSourcesAnswer(supabase);

  const vector = await embedText(question);
  const retrievalDepth = getRetrievalDepth(mode, intent);
  const [{ data: chunks }, { data: items }] = await Promise.all([
    supabase.rpc("match_document_chunks", { query_embedding: vector, match_count: retrievalDepth.candidates }),
    supabase.rpc("match_knowledge_items", { query_embedding: vector, match_count: 12 })
  ]);

  const chunkRows = (chunks || []) as MatchChunk[];
  if (!chunkRows.length) {
    return insufficientAnswer("Chưa đủ căn cứ trong kho tri thức để trả lời câu hỏi này.");
  }

  const neighborSelectors = chunkRows.flatMap((chunk) => {
    const index = typeof chunk.metadata?.chunk_index === "number" ? chunk.metadata.chunk_index : null;
    if (index === null) return [];
    return [
      { document_id: chunk.document_id, chunk_index: index - 1 },
      { document_id: chunk.document_id, chunk_index: index },
      { document_id: chunk.document_id, chunk_index: index + 1 }
    ];
  });
  const documentIds = Array.from(new Set(chunkRows.map((chunk) => chunk.document_id)));
  const { data: neighborRows } = await supabase
    .from("document_chunks")
    .select("id,document_id,chunk_index,content")
    .in("document_id", documentIds);

  const { data: documents } = await supabase
    .from("source_documents")
    .select("id,title,file_name,source_url,mime_type,source_type")
    .in("id", documentIds);

  const documentById = new Map(((documents || []) as SourceDocumentLite[]).map((doc) => [doc.id, doc]));
  const selectedNeighborKeys = new Set(neighborSelectors.map((item) => `${item.document_id}:${item.chunk_index}`));
  const neighborByKey = new Map(
    ((neighborRows || []) as NeighborChunk[])
      .filter((chunk) => selectedNeighborKeys.has(`${chunk.document_id}:${chunk.chunk_index}`))
      .map((chunk) => [`${chunk.document_id}:${chunk.chunk_index}`, chunk])
  );

  const evidence = dedupeEvidence(
    chunkRows
      .map((chunk) => {
        const index = typeof chunk.metadata?.chunk_index === "number" ? chunk.metadata.chunk_index : null;
        const context =
          index === null
            ? chunk.content
            : [index - 1, index, index + 1]
                .map((nearIndex) => neighborByKey.get(`${chunk.document_id}:${nearIndex}`)?.content)
                .filter(Boolean)
                .join("\n\n");
        const cleanedContext = cleanEvidenceText(context || chunk.content);
        return {
          chunk_id: chunk.id,
          document_id: chunk.document_id,
          document_title:
            documentById.get(chunk.document_id)?.title ||
            documentById.get(chunk.document_id)?.file_name ||
            documentById.get(chunk.document_id)?.source_url ||
            "Nguồn",
          excerpt: excerpt(cleanedContext, 2600),
          similarity: chunk.similarity,
          chunk_index: index,
          rerank_score: scoreLegalEvidence(question, cleanedContext, chunk.similarity)
        };
      })
      .sort((a, b) => b.rerank_score - a.rerank_score)
      .slice(0, retrievalDepth.evidence)
  );

  const answerTask = chooseAnswerTask(mode, {
    sourceCount: documentIds.length,
    evidenceCount: evidence.length,
    isLegal: detectLegalQuery(question),
    intent
  });
  const parsed = await runAiJson(
    answerTask,
    [
      { role: "system", content: answerInstructions(mode, intent) },
      {
        role: "user",
        content: JSON.stringify({
          question,
          answer_requirements: [
            "Trả lời bằng tiếng Việt có dấu.",
            "Bám đúng ý định câu hỏi và chế độ trả lời đã chọn.",
            "Không đưa document_id, chunk_id, retrieval_notes hay thuật ngữ nội bộ vào phần văn bản hiển thị.",
            "Không bịa điều kiện, ngoại lệ, số điều hoặc thuật ngữ không có trong nguồn.",
            "Mỗi citation phải dùng document_id và chunk_id có trong evidence_chunks.",
            "Chỉ nêu điều/khoản khi đoạn nguồn thực sự hỗ trợ."
          ],
          retrieval_notes: {
            answer_mode: mode,
            query_intent: intent,
            ai_task: answerTask,
            retrieved_candidates: chunkRows.length,
            evidence_used: evidence.length,
            strategy: [
              "semantic retrieval",
              "neighbor context before/after chunk",
              "legal keyword rerank",
              "duplicate evidence removal"
            ]
          },
          knowledge_items: items || [],
          evidence_chunks: evidence
        })
      }
    ],
    answerSchema
  );

  const validEvidenceKeys = new Set(evidence.map((item) => `${item.document_id}:${item.chunk_id}`));
  const sectionLimit = mode === "fast" ? 1 : mode === "standard" ? 4 : 8;
  const sourceLimit = mode === "fast" ? 3 : mode === "standard" ? 5 : 8;
  const parsedSections = (parsed.sections || []).slice(0, sectionLimit).map((section) => ({
    heading: sanitizePublicText(section.heading),
    content: sanitizePublicText(section.content)
  }));
  const parsedCitations = parsed.citations || [];
  const citations = dedupeCitations(
    parsedCitations.filter((citation) => validEvidenceKeys.has(`${citation.document_id}:${citation.chunk_id || ""}`)),
    evidence,
    sourceLimit
  );

  return {
    direct_answer: sanitizePublicText(parsed.direct_answer),
    sections: parsedSections,
    practical_conclusion: mode === "fast" ? "" : sanitizePublicText(parsed.practical_conclusion || ""),
    citations,
    confidence: parsed.confidence,
    insufficient_evidence: parsed.insufficient_evidence || false
  } satisfies StructuredAnswerPayload;
}

export async function normalizeSavedAnswer(answer: string, citations: Citation[]) {
  return runAiJson(
    "SAVE_INSIGHT",
    [
      {
        role: "system",
        content: `Turn a useful assistant answer into reusable knowledge.
Preserve citations.
Remove conversational filler.
Keep uncertainty.
Do not promote unsupported inference into fact.
Return JSON only with this exact shape:
{
  "title": "string",
  "item_type": "insight",
  "short_summary": "string",
  "body": "string",
  "confidence": 0.75
}`
      },
      { role: "user", content: JSON.stringify({ answer, citations }) }
    ],
    savedKnowledgeSchema
  );
}
