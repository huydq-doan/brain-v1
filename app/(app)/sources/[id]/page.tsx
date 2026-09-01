import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";
import { SourceActions } from "./source-actions";
import { SourceReader } from "./source-reader";

type GeneratedKnowledge = {
  knowledge_item_id: string;
  knowledge_items: {
    title: string;
    short_summary: string;
  } | null;
};

function sourceKindLabel(sourceType?: string | null, mimeType?: string | null) {
  if (sourceType === "url") return "Nguồn web";
  if (mimeType?.includes("pdf")) return "PDF";
  if (mimeType?.includes("word")) return "Word";
  if (mimeType?.includes("markdown") || mimeType?.includes("text")) return "Văn bản";
  return "Tài liệu";
}

export default async function SourceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: source } = await supabase
    .from("source_documents")
    .select("*, document_chunks(id,chunk_index,content,token_count), knowledge_sources(knowledge_item_id,quote_text,knowledge_items(id,title,item_type,short_summary))")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!source) notFound();

  const chunks = source.document_chunks || [];
  const knowledgeSources = (source.knowledge_sources || []) as GeneratedKnowledge[];
  const sourceTitle = source.title || source.file_name || source.source_url || "Nguồn chưa đặt tên";
  const rawText = source.raw_text || chunks.map((chunk: { content?: string }) => chunk.content || "").join("\n\n");
  const totalTokens = chunks.reduce((sum: number, chunk: { token_count?: number | null }) => sum + (chunk.token_count || 0), 0);

  return (
    <section className="pb-10">
      <div className="rounded-xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-ink/45">
              <span>{sourceKindLabel(source.source_type, source.mime_type)}</span>
              {source.file_name ? <span>• {source.file_name}</span> : null}
            </div>
            <h1 className="mt-2 break-words text-2xl font-black leading-tight text-ink sm:text-3xl">{sourceTitle}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink/55">
              <span className="rounded-full bg-mist px-3 py-1">{chunks.length} đoạn</span>
              {totalTokens ? <span className="rounded-full bg-mist px-3 py-1">~{totalTokens.toLocaleString("vi-VN")} token</span> : null}
              {knowledgeSources.length ? <span className="rounded-full bg-mist px-3 py-1">{knowledgeSources.length} tri thức</span> : null}
            </div>
          </div>
          <StatusPill status={source.status} />
        </div>
      </div>

      {source.error_message ? <p className="mt-4 rounded-md bg-clay/10 p-3 text-sm text-clay">{source.error_message}</p> : null}
      {source.metadata?.analysis_warning ? (
        <p className="mt-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
          Đã đọc và lưu nguồn, nhưng AI chưa tạo được tri thức tự động: {source.metadata.analysis_warning}
        </p>
      ) : null}

      <SourceActions sourceId={source.id} sourceTitle={sourceTitle} />

      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-ink/40">BRAIN đã rút ra</p>
            <h2 className="mt-1 text-lg font-black text-ink">Tri thức từ tài liệu</h2>
          </div>
          <Link href="/knowledge" className="text-xs font-bold text-leaf">Xem kho tri thức →</Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {knowledgeSources.map((entry) =>
            entry.knowledge_items ? (
              <Link key={entry.knowledge_item_id} href={`/knowledge/${entry.knowledge_item_id}`} className="block rounded-lg border border-line bg-white p-4 shadow-soft transition hover:border-leaf/40">
                <p className="font-black leading-6 text-ink">{entry.knowledge_items.title}</p>
                <p className="mt-1 text-sm leading-6 text-ink/60">{entry.knowledge_items.short_summary}</p>
              </Link>
            ) : null
          )}
          {!knowledgeSources.length ? <p className="text-sm text-ink/60">Chưa có tri thức nào được tạo.</p> : null}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3">
          <p className="text-xs font-black uppercase tracking-wide text-ink/40">Nguồn gốc</p>
          <h2 className="mt-1 text-lg font-black text-ink">Nội dung tài liệu</h2>
          <p className="mt-1 text-sm text-ink/55">Đã định dạng lại để đọc như tài liệu, thay vì đổ nguyên khối văn bản kỹ thuật.</p>
        </div>
        <SourceReader rawText={rawText || ""} />
      </section>
    </section>
  );
}
