export type SourceStatus = "uploaded" | "parsing" | "analyzing" | "ready" | "failed";
export type SourceType = "file" | "url" | "text";
export type KnowledgeType =
  | "concept"
  | "person"
  | "organization"
  | "event"
  | "timeline"
  | "rule"
  | "decision"
  | "case"
  | "summary"
  | "insight"
  | "other";

export type Citation = {
  claim?: string;
  document_id: string;
  document_title: string;
  section?: string;
  chunk_id: string | null;
  excerpt: string;
};

export type AnswerSection = {
  heading: string;
  content: string;
};

export type StructuredAnswerPayload = {
  direct_answer: string;
  sections: AnswerSection[];
  practical_conclusion: string;
  citations: Citation[];
  confidence: number;
  insufficient_evidence: boolean;
};

export type DbClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
