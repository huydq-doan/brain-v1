import { z } from "zod";
import { analyzerSchema, answerSchema, reconcilerSchema, savedKnowledgeSchema } from "@/lib/ai/schemas";

export const aiTaskSchema = z.enum([
  "DOCUMENT_CLASSIFY",
  "DOCUMENT_ANALYZE",
  "KNOWLEDGE_EXTRACT",
  "KNOWLEDGE_RECONCILE",
  "CONFLICT_ANALYZE",
  "QUERY_CLASSIFY",
  "ANSWER_FAST",
  "ANSWER_STANDARD",
  "ANSWER_DEEP",
  "SAVE_INSIGHT"
]);

export type AiTaskType = z.infer<typeof aiTaskSchema>;
export type AnswerMode = "fast" | "standard" | "deep";
export type QueryIntent = "source_list" | "definition" | "lookup" | "compare" | "analysis";
export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";
export type Verbosity = "low" | "medium" | "high";

export type AiTaskConfig<T> = {
  taskType: AiTaskType;
  model: string;
  reasoningEffort: ReasoningEffort;
  verbosity: Verbosity;
  maxOutputTokens: number;
  schemaName: string;
  schema: z.ZodType<T>;
  escalation?: AiTaskType;
};

type AnyAiTaskConfig = Omit<AiTaskConfig<unknown>, "taskType">;

const modelPolicy = {
  luna: process.env.OPENAI_MODEL_LUNA || "gpt-5.6-luna",
  terra: process.env.OPENAI_MODEL_TERRA || "gpt-5.6-terra",
  sol: process.env.OPENAI_MODEL_SOL || "gpt-5.6-sol"
};

const taskConfigs: Record<AiTaskType, AnyAiTaskConfig> = {
  DOCUMENT_CLASSIFY: {
    model: modelPolicy.luna, reasoningEffort: "low", verbosity: "low", maxOutputTokens: 1200,
    schemaName: "document_classification",
    schema: z.object({ title: z.string(), source_kind: z.string(), language: z.string(), topics: z.array(z.string()).default([]), confidence: z.number().min(0).max(1) }),
    escalation: "DOCUMENT_ANALYZE"
  },
  DOCUMENT_ANALYZE: { model: modelPolicy.terra, reasoningEffort: "medium", verbosity: "medium", maxOutputTokens: 12000, schemaName: "document_analysis", schema: analyzerSchema as z.ZodType<unknown>, escalation: "CONFLICT_ANALYZE" },
  KNOWLEDGE_EXTRACT: { model: modelPolicy.terra, reasoningEffort: "medium", verbosity: "medium", maxOutputTokens: 12000, schemaName: "knowledge_extract", schema: analyzerSchema as z.ZodType<unknown>, escalation: "CONFLICT_ANALYZE" },
  KNOWLEDGE_RECONCILE: { model: modelPolicy.terra, reasoningEffort: "medium", verbosity: "medium", maxOutputTokens: 3000, schemaName: "knowledge_reconcile", schema: reconcilerSchema as z.ZodType<unknown>, escalation: "CONFLICT_ANALYZE" },
  CONFLICT_ANALYZE: { model: modelPolicy.sol, reasoningEffort: "high", verbosity: "medium", maxOutputTokens: 5000, schemaName: "conflict_analyze", schema: reconcilerSchema as z.ZodType<unknown> },
  QUERY_CLASSIFY: {
    model: modelPolicy.luna, reasoningEffort: "low", verbosity: "low", maxOutputTokens: 900, schemaName: "query_classify",
    schema: z.object({ answer_mode: z.enum(["fast", "standard", "deep"]), is_legal_or_professional: z.boolean(), requires_multi_source: z.boolean(), complexity: z.enum(["low", "medium", "high"]), reason: z.string() }),
    escalation: "ANSWER_STANDARD"
  },
  ANSWER_FAST: { model: modelPolicy.terra, reasoningEffort: "low", verbosity: "low", maxOutputTokens: 1800, schemaName: "answer_fast", schema: answerSchema as z.ZodType<unknown>, escalation: "ANSWER_STANDARD" },
  ANSWER_STANDARD: { model: modelPolicy.terra, reasoningEffort: "medium", verbosity: "medium", maxOutputTokens: 5000, schemaName: "answer_standard", schema: answerSchema as z.ZodType<unknown>, escalation: "ANSWER_DEEP" },
  ANSWER_DEEP: { model: modelPolicy.sol, reasoningEffort: "high", verbosity: "high", maxOutputTokens: 10000, schemaName: "answer_deep", schema: answerSchema as z.ZodType<unknown> },
  SAVE_INSIGHT: { model: modelPolicy.terra, reasoningEffort: "medium", verbosity: "medium", maxOutputTokens: 3000, schemaName: "save_insight", schema: savedKnowledgeSchema as z.ZodType<unknown>, escalation: "ANSWER_DEEP" }
};

export function getAiTaskConfig<T>(taskType: AiTaskType): AiTaskConfig<T> {
  const config = taskConfigs[taskType] as Omit<AiTaskConfig<T>, "taskType">;
  return { taskType, ...config };
}

export function detectQueryIntent(question: string): QueryIntent {
  const q = question.trim().toLowerCase();
  if (/(liệt kê|danh sách|có những|có bao nhiêu).*(tài liệu|nguồn)|tài liệu nguồn|nguồn hiện có/.test(q)) return "source_list";
  if (/(là gì|khái niệm|định nghĩa|được hiểu là)/.test(q)) return "definition";
  if (/(so sánh|khác nhau|giống nhau|đối chiếu)/.test(q)) return "compare";
  if (/(phân tích|đánh giá|rà soát|rủi ro|đề xuất|tư vấn|nhận xét|vì sao|tại sao)/.test(q)) return "analysis";
  return "lookup";
}

export function chooseAnswerTask(mode: AnswerMode, signals: { sourceCount: number; evidenceCount: number; isLegal: boolean; intent?: QueryIntent }) {
  if (mode === "fast") return "ANSWER_FAST";
  if (mode === "deep") return "ANSWER_DEEP";
  if (signals.intent === "analysis" && signals.isLegal && signals.sourceCount > 2 && signals.evidenceCount > 10) return "ANSWER_DEEP";
  return "ANSWER_STANDARD";
}

export function getRetrievalDepth(mode: AnswerMode, intent: QueryIntent = "lookup") {
  if (intent === "definition") {
    if (mode === "deep") return { candidates: 24, evidence: 12 };
    if (mode === "fast") return { candidates: 10, evidence: 4 };
    return { candidates: 16, evidence: 8 };
  }
  if (mode === "deep") return { candidates: 36, evidence: 20 };
  if (mode === "fast") return { candidates: 10, evidence: 5 };
  return { candidates: 24, evidence: 12 };
}

export function detectLegalQuery(question: string) {
  return /luật|nghị định|thông tư|điều\s+\d+|khoản\s+\d+|pháp lý|đấu thầu|hợp đồng|quy định/i.test(question);
}

export function getPublicModelPolicy() {
  return {
    tasks: Object.fromEntries(Object.entries(taskConfigs).map(([task, config]) => [task, { model: config.model, reasoningEffort: config.reasoningEffort, verbosity: config.verbosity, maxOutputTokens: config.maxOutputTokens, escalation: config.escalation || null }]))
  };
}
