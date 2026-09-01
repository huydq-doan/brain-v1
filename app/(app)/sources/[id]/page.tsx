import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";

type GeneratedKnowledge = {
  knowledge_item_id: string;
  knowledge_items: {
    title: string;
    short_summary: string;
  } | null;
};

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

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-black text-ink">{source.title || source.file_name || source.source_url}</h1>
          <p className="mt-1 text-sm text-ink/60">{source.file_name || source.source_url || source.source_type}</p>
        </div>
        <StatusPill status={source.status} />
      </div>
      {source.error_message ? <p className="mt-4 rounded-md bg-clay/10 p-3 text-sm text-clay">{source.error_message}</p> : null}
      {source.metadata?.analysis_warning ? (
        <p className="mt-4 rounded-md bg-clay/10 p-3 text-sm text-clay">
          Đã đọc và lưu nguồn, nhưng AI chưa tạo được tri thức tự động: {source.metadata.analysis_warning}
        </p>
      ) : null}
      <section className="mt-6">
        <h2 className="text-sm font-black uppercase text-ink/60">Tri thức sinh ra</h2>
        <div className="mt-3 space-y-2">
          {knowledgeSources.map((entry) =>
            entry.knowledge_items ? (
              <Link key={entry.knowledge_item_id} href={`/knowledge/${entry.knowledge_item_id}`} className="block rounded-md border border-line bg-white p-3">
                <p className="font-bold text-ink">{entry.knowledge_items.title}</p>
                <p className="mt-1 text-sm text-ink/60">{entry.knowledge_items.short_summary}</p>
              </Link>
            ) : null
          )}
          {!knowledgeSources.length ? <p className="text-sm text-ink/60">Chưa có tri thức nào được tạo.</p> : null}
        </div>
      </section>
      <section className="mt-6">
        <h2 className="text-sm font-black uppercase text-ink/60">Xem trước nội dung</h2>
        <div className="mt-3 rounded-lg border border-line bg-white p-4 text-sm leading-6 text-ink/75">
          {(source.raw_text || "").slice(0, 4000) || chunks[0]?.content || "Chưa có nội dung đọc được."}
        </div>
      </section>
    </section>
  );
}
