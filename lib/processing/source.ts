import { embedText } from "@/lib/ai/client";
import { analyzeDocument } from "@/lib/processing/knowledge";
import { chunkText, estimateTokens, extractFileText, fetchUrlText, normalizeText } from "@/lib/processing/text";
import type { DbClient } from "@/lib/types";

export type ProcessingResult = {
  status: "ready" | "failed";
  warning?: string;
};

export async function processDocument(supabase: DbClient, documentId: string, fileBuffer?: Buffer): Promise<ProcessingResult> {
  const { data: document, error } = await supabase.from("source_documents").select("*").eq("id", documentId).single();
  if (error) throw error;

  const { data: job, error: jobError } = await supabase
    .from("processing_jobs")
    .insert({
      user_id: document.user_id,
      document_id: documentId,
      job_type: "ingest",
      status: "running",
      attempts: 1,
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();
  if (jobError) throw jobError;

  try {
    await supabase.from("source_documents").update({ status: "parsing", error_message: null }).eq("id", documentId);

    let rawText = document.raw_text || "";
    if (document.source_type === "file") {
      if (!fileBuffer && document.storage_path) {
        const { data: downloaded, error: downloadError } = await supabase.storage
          .from("brain-sources")
          .download(document.storage_path);
        if (downloadError) throw downloadError;
        fileBuffer = Buffer.from(await downloaded.arrayBuffer());
      }
      if (!fileBuffer) throw new Error("File content is not available for parsing.");
      rawText = await extractFileText(fileBuffer, document.mime_type || "", document.file_name || "upload");
    }
    if (document.source_type === "url") {
      if (!document.source_url) throw new Error("Missing URL.");
      rawText = await fetchUrlText(document.source_url);
    }
    if (document.source_type === "text") {
      rawText = normalizeText(rawText);
    }
    if (!rawText || rawText.length < 10) throw new Error("No readable text was extracted.");

    await supabase.from("document_chunks").delete().eq("document_id", documentId);
    const chunks = chunkText(rawText);
    const chunkRows = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const content = chunks[index];
      const embedding = await embedText(content);
      chunkRows.push({
        document_id: documentId,
        user_id: document.user_id,
        chunk_index: index,
        content,
        token_count: estimateTokens(content),
        embedding,
        metadata: { parser: "brain-v1", chunk_index: index }
      });
    }
    if (chunkRows.length) {
      const { error: chunkError } = await supabase.from("document_chunks").insert(chunkRows);
      if (chunkError) throw chunkError;
    }

    await supabase
      .from("source_documents")
      .update({ status: "analyzing", raw_text: rawText, metadata: { ...(document.metadata || {}), chunk_count: chunks.length } })
      .eq("id", documentId);

    let warning: string | undefined;
    try {
      await analyzeDocument(supabase, documentId);
    } catch (analysisError) {
      warning =
        analysisError instanceof Error
          ? analysisError.message
          : "Đã đọc được nguồn, nhưng chưa tạo được tri thức tự động.";
      await supabase
        .from("source_documents")
        .update({
          metadata: {
            ...(document.metadata || {}),
            chunk_count: chunks.length,
            analysis_warning: warning
          }
        })
        .eq("id", documentId);
    }

    await supabase.from("source_documents").update({ status: "ready" }).eq("id", documentId);
    await supabase
      .from("processing_jobs")
      .update({ status: "succeeded", error_message: warning || null, finished_at: new Date().toISOString() })
      .eq("id", job.id);
    return { status: "ready", warning };
  } catch (processError) {
    const message = processError instanceof Error ? processError.message : "Processing failed.";
    await supabase.from("source_documents").update({ status: "failed", error_message: message }).eq("id", documentId);
    await supabase
      .from("processing_jobs")
      .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", job.id);
    throw processError;
  }
}
