import { z } from "zod";

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

export const analyzerSchema = z.object({
  candidates: z.array(
    z.object({
      title: z.string().min(1),
      item_type: knowledgeTypeSchema,
      short_summary: z.string().min(1),
      body: z.string().min(1),
      confidence: z.number().min(0).max(1),
      supporting_chunk_ids: z.array(z.string()).min(1),
      entities: z.array(z.string()).default([]),
      dates: z.array(z.string()).default([]),
      relation_hints: z
        .array(
          z.object({
            target_title: z.string(),
            relation_type: z.enum([
              "related_to",
              "supports",
              "contradicts",
              "depends_on",
              "part_of",
              "causes",
              "updates",
              "example_of"
            ]),
            explanation: z.string(),
            confidence: z.number().min(0).max(1)
          })
        )
        .default([])
    })
  ),
  internal_conflicts: z.array(z.string()).default([])
});

export const reconcilerSchema = z.object({
  action: z.enum(["CREATE", "UPDATE", "NO_CHANGE", "CONFLICT"]),
  target_item_id: z.string().uuid().nullable(),
  title: z.string().min(1),
  short_summary: z.string().min(1),
  body: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  relation_type: z.enum(["related_to", "supports", "contradicts", "updates"]).default("related_to")
});

export const answerSchema = z.object({
  direct_answer: z.string().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        content: z.string().min(1)
      })
    )
    .default([]),
  practical_conclusion: z.string().default(""),
  citations: z
    .array(
      z.object({
        claim: z.string().min(1),
        document_id: z.string().min(1),
        document_title: z.string().min(1),
        section: z.string().default(""),
        chunk_id: z.string().nullable(),
        excerpt: z.string().min(1)
      })
    )
    .default([]),
  confidence: z.number().min(0).max(1),
  insufficient_evidence: z.boolean().default(false)
});

export type StructuredAnswer = z.infer<typeof answerSchema>;

export const savedKnowledgeSchema = z.object({
  title: z.string().min(1),
  item_type: knowledgeTypeSchema.default("insight"),
  short_summary: z.string().min(1),
  body: z.string().min(1),
  confidence: z.number().min(0).max(1)
});
