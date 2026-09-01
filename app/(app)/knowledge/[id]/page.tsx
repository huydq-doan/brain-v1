import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";

type KnowledgeSource = {
  id: string;
  document_id: string;
  quote_text: string;
  source_documents: {
    title: string | null;
    file_name: string | null;
    source_url: string | null;
  } | null;
};

type KnowledgeHistory = {
  id: string;
  change_type: string;
  reason: string | null;
};

export default async function KnowledgeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("knowledge_items")
    .select("*, knowledge_sources(id,quote_text,relevance,document_id,chunk_id,source_documents(id,title,file_name,source_url)), knowledge_history(id,change_type,reason,created_at)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!item) notFound();

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-black text-ink">{item.title}</h1>
          <p className="mt-2 text-sm font-semibold uppercase text-ink/50">{item.item_type}</p>
        </div>
        <StatusPill status={item.status} />
      </div>
      <p className="mt-5 rounded-lg border border-line bg-white p-4 text-base leading-7 text-ink/75">{item.short_summary}</p>
      <article className="mt-4 whitespace-pre-wrap rounded-lg border border-line bg-white p-4 text-sm leading-7 text-ink/80">{item.body}</article>
      <section className="mt-6">
        <h2 className="text-sm font-black uppercase text-ink/60">Nguồn</h2>
        <div className="mt-3 space-y-2">
          {((item.knowledge_sources || []) as KnowledgeSource[]).map((source) => (
            <Link key={source.id} href={`/sources/${source.document_id}`} className="block rounded-md border border-line bg-white p-3">
              <p className="font-bold text-ink">
                {source.source_documents?.title || source.source_documents?.file_name || source.source_documents?.source_url || "Nguồn"}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/65">{source.quote_text}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-6">
        <h2 className="text-sm font-black uppercase text-ink/60">Lịch sử</h2>
        <div className="mt-3 space-y-2">
          {((item.knowledge_history || []) as KnowledgeHistory[]).map((entry) => (
            <div key={entry.id} className="rounded-md border border-line bg-white p-3 text-sm text-ink/65">
              <span className="font-bold text-ink">{entry.change_type}</span> {entry.reason || ""}
            </div>
          ))}
          {!item.knowledge_history?.length ? <p className="text-sm text-ink/60">Chưa có thay đổi nào.</p> : null}
        </div>
      </section>
    </section>
  );
}
