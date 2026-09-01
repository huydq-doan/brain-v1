import { describe, expect, it } from "vitest";
import { chunkText, estimateTokens, stripHtml } from "@/lib/processing/text";
import { slugify } from "@/lib/processing/knowledge";
import { analyzerSchema } from "@/lib/ai/schemas";

describe("text processing", () => {
  it("strips html into readable text", () => {
    expect(stripHtml("<h1>Hello</h1><script>bad()</script><p>World&nbsp;&amp;</p>")).toBe("Hello World &");
  });

  it("chunks long content without dropping text", () => {
    const text = Array.from({ length: 2200 }, (_, index) => `word${index}`).join(" ");
    const chunks = chunkText(text, 500, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(" ")).toContain("word0");
    expect(estimateTokens(chunks[0])).toBeGreaterThan(100);
  });

  it("creates stable ascii slugs", () => {
    expect(slugify("Quy tac Tinh nang Moi!")).toBe("quy-tac-tinh-nang-moi");
  });
});

describe("ai schemas", () => {
  it("requires candidates to cite chunks", () => {
    expect(() =>
      analyzerSchema.parse({
        candidates: [
          {
            title: "A",
            item_type: "concept",
            short_summary: "B",
            body: "C",
            confidence: 0.8,
            supporting_chunk_ids: []
          }
        ],
        internal_conflicts: []
      })
    ).toThrow();
  });
});
