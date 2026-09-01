import { analyzerSchema, answerSchema, reconcilerSchema, savedKnowledgeSchema } from "@/lib/ai/schemas";
import { embedText, runAiJson } from "@/lib/ai/client";
import {
  chooseAnswerTask,
  detectLegalQuery,
  getRetrievalDepth,
  type AnswerMode
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

function dedupeCitations(citations: Citation[], fallbackEvidence: EvidenceChunk[]) {
  const evidenceByKey = new Map(fallbackEvidence.map((item) => [`${item.document_id}:${item.chunk_id}`, item]));
  const seen = new Set<string>();
  const cleaned: Citation[] = [];

  for (const citation of citations) {
    const key = `${citation.document_id}:${citation.chunk_id || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fallback = evidenceByKey.get(key);
    cleaned.push({
      claim: citation.claim,
      document_id: citation.document_id,
      document_title: citation.document_title || fallback?.document_title || "Nguồn",
      section: citation.section,
      chunk_id: citation.chunk_id,
      excerpt: excerpt(citation.excerpt || fallback?.excerpt || "", 520)
    });
  }

  if (cleaned.length) return cleaned.slice(0, 6);
  return fallbackEvidence.slice(0, 4).map((item) => ({
    document_id: item.document_id,
    document_title: item.document_title,
    section: "Căn cứ",
    chunk_id: item.chunk_id,
    excerpt: excerpt(item.excerpt, 520)
  }));
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

const answerSystem = `Bạn là BRAIN — chuyên gia phân tích tri thức và trợ lý nghiên cứu chuyên sâu.

Mục tiêu của bạn không phải trả lời ngắn cho xong, mà phải giúp người dùng hiểu bản chất vấn đề, thấy được cấu trúc, căn cứ, điều kiện áp dụng, ngoại lệ, rủi ro và điểm cần lưu ý.

Mỗi câu trả lời phải:
1. Trả lời trực tiếp câu hỏi ngay đầu.
2. Giải thích bản chất và khái niệm.
3. Phân chia nội dung thành các tiêu mục rõ ràng.
4. Dùng bullet hoặc bảng khi giúp người đọc hiểu nhanh hơn.
5. Nếu có căn cứ pháp lý hoặc tài liệu nguồn, phải nêu đúng tên nguồn, điều/khoản/mục nếu dữ liệu truy xuất cho phép.
6. Phân biệt rõ nội dung nguồn quy định trực tiếp, phần AI tổng hợp/diễn giải, và nhận định/suy luận.
7. Nếu có điều kiện áp dụng, ngoại lệ, trường hợp đặc biệt hoặc giới hạn, phải trình bày riêng.
8. Nếu có nhiều nguồn liên quan, phải tổng hợp thành một câu trả lời thống nhất.
9. Nếu các nguồn mâu thuẫn hoặc khác thời điểm hiệu lực, phải cảnh báo rõ.
10. Nếu nguồn chưa đủ để kết luận, phải nói rõ "Chưa đủ căn cứ từ kho tri thức hiện có", không được bịa.

Cấu trúc mặc định:
- Trả lời ngắn
- Bản chất
- Quy định / Nội dung chính
- Điều kiện áp dụng
- Trường hợp ngoại lệ / Lưu ý
- Căn cứ
- Kết luận thực hành

Chỉ bỏ một mục khi thực sự không liên quan. Không viết một khối văn dài. Không lặp lại câu hỏi. Không trích dẫn đoạn không hỗ trợ trực tiếp cho luận điểm. Không hiển thị raw chunk hoặc văn bản kỹ thuật cho người dùng.

Return JSON only with this exact shape:
{
  "direct_answer": "string",
  "sections": [{"heading": "string", "content": "string"}],
  "practical_conclusion": "string",
  "citations": [{
    "claim": "string",
    "document_id": "string",
    "document_title": "string",
    "section": "string",
    "chunk_id": "string",
    "excerpt": "string"
  }],
  "confidence": 0.0,
  "insufficient_evidence": false
}`;

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

export async function answerQuestion(supabase: DbClient, question: string, mode: AnswerMode = "standard") {
  const vector = await embedText(question);
  const retrievalDepth = getRetrievalDepth(mode);
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
    isLegal: detectLegalQuery(question)
  });
  const parsed = await runAiJson(
    answerTask,
    [
      { role: "system", content: answerSystem },
      {
        role: "user",
        content: JSON.stringify({
          question,
          answer_requirements: [
            "Trả lời bằng tiếng Việt có dấu.",
            "Không trả lời chung chung.",
            "Dựa vào điều/khoản hoặc câu chữ trong evidence nếu có.",
            "Nếu câu hỏi là 'là gì', hãy nêu định nghĩa trước rồi mới giải thích thêm.",
            "Không bịa điều kiện, ngoại lệ, số điều hoặc thuật ngữ không có trong evidence.",
            "Mỗi citation phải dùng document_id và chunk_id có trong evidence_chunks.",
            "Nếu evidence có Điều 21 liên quan đấu thầu rộng rãi, phải nêu rõ trong phần căn cứ."
          ],
          retrieval_notes: {
            answer_mode: mode,
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
  const parsedSections = parsed.sections || [];
  const parsedCitations = parsed.citations || [];
  const citations = dedupeCitations(
    parsedCitations.filter((citation) => validEvidenceKeys.has(`${citation.document_id}:${citation.chunk_id || ""}`)),
    evidence
  );

  return {
    direct_answer: parsed.direct_answer,
    sections: parsedSections,
    practical_conclusion: parsed.practical_conclusion || "",
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
