import { z } from "zod";

const confidenceSchema = z.coerce.number().transform((value) => Math.max(0, Math.min(1, value))).catch(0.6);

export const knowledgeTypeSchema = z.enum([
  "concept",
  "person",
  "organization",
  "event",
  "timeline",
  "rule",
  "decision",
  "case",
  "summary",
  "insight",
  "other"
]);

const tolerantKnowledgeTypeSchema = knowledgeTypeSchema.catch("other");

export const analyzerSchema = z.object({
  candidates: z.array(
    z.object({
      title: z.string().min(1),
      item_type: tolerantKnowledgeTypeSchema.default("other"),
      short_summary: z.string().default(""),
      body: z.string().default(""),
      confidence: confidenceSchema,
      supporting_chunk_ids: z.array(z.string()).default([]),
      entities: z.array(z.string()).default([]),
      dates: z.array(z.string()).default([]),
      relation_hints: z
        .array(
          z.object({
            target_title: z.string().default(""),
            relation_type: z
              .enum([
                "related_to",
                "supports",
                "contradicts",
                "depends_on",
                "part_of",
                "causes",
                "updates",
                "example_of"
              ])
              .catch("related_to"),
            explanation: z.string().default(""),
            confidence: confidenceSchema
          })
        )
        .default([])
    })
  ).default([]),
  internal_conflicts: z.array(z.string()).default([])
});

export const reconcilerSchema = z.object({
  action: z.enum(["CREATE", "UPDATE", "NO_CHANGE", "CONFLICT"]).catch("CREATE"),
  target_item_id: z.string().nullable().default(null),
  title: z.string().min(1),
  short_summary: z.string().default(""),
  body: z.string().default(""),
  confidence: confidenceSchema,
  reason: z.string().default(""),
  relation_type: z.enum(["related_to", "supports", "contradicts", "updates"]).catch("related_to").default("related_to")
});

export const answerSchema = z.object({
  direct_answer: z.string().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().default(""),
        content: z.string().default("")
      })
    )
    .default([]),
  practical_conclusion: z.string().default(""),
  citations: z
    .array(
      z.object({
        claim: z.string().default(""),
        document_id: z.string().default(""),
        document_title: z.string().default("Nguồn"),
        section: z.string().default(""),
        chunk_id: z.string().nullable().optional().default(null),
        excerpt: z.string().default("")
      })
    )
    .default([]),
  confidence: confidenceSchema,
  insufficient_evidence: z.boolean().catch(false).default(false)
});

export type StructuredAnswer = z.infer<typeof answerSchema>;

export const savedKnowledgeSchema = z.object({
  title: z.string().min(1),
  item_type: tolerantKnowledgeTypeSchema.default("insight"),
  short_summary: z.string().default(""),
  body: z.string().default(""),
  confidence: confidenceSchema
});
