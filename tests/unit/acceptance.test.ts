import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/0001_brain_v1.sql", "utf8");
const manifest = readFileSync("public/manifest.webmanifest", "utf8");

describe("BRAIN V1 acceptance scaffolding", () => {
  it("enables RLS for user-owned tables", () => {
    for (const table of [
      "source_documents",
      "document_chunks",
      "knowledge_items",
      "conversations",
      "messages",
      "processing_jobs"
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("includes pgvector search functions", () => {
    expect(migration).toContain("create extension if not exists vector");
    expect(migration).toContain("match_document_chunks");
    expect(migration).toContain("match_knowledge_items");
  });

  it("ships an installable PWA manifest", () => {
    const parsed = JSON.parse(manifest);
    expect(parsed.display).toBe("standalone");
    expect(parsed.start_url).toBe("/ask");
    expect(parsed.icons.length).toBeGreaterThan(0);
  });
});
