import { describe, expect, it } from "vitest";
import { chooseAnswerTask, detectQueryIntent, getAiTaskConfig, getRetrievalDepth } from "@/lib/ai/router";

describe("answer routing", () => {
  it("detects source-list intent without invoking a deep answer style", () => {
    expect(detectQueryIntent("Hãy liệt kê các tài liệu nguồn")).toBe("source_list");
    expect(detectQueryIntent("Có những nguồn nào trong kho?")).toBe("source_list");
  });

  it("routes fast mode to a genuinely compact task", () => {
    expect(chooseAnswerTask("fast", { sourceCount: 8, evidenceCount: 20, isLegal: true, intent: "analysis" })).toBe("ANSWER_FAST");
    const config = getAiTaskConfig("ANSWER_FAST");
    expect(config.verbosity).toBe("low");
    expect(config.maxOutputTokens).toBeLessThanOrEqual(2000);
  });

  it("keeps fast retrieval smaller than standard and deep", () => {
    const fast = getRetrievalDepth("fast", "lookup");
    const standard = getRetrievalDepth("standard", "lookup");
    const deep = getRetrievalDepth("deep", "lookup");
    expect(fast.evidence).toBeLessThan(standard.evidence);
    expect(standard.evidence).toBeLessThan(deep.evidence);
  });
});
