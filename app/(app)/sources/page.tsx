import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";

export default async function SourcesPage() {
  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("source_documents")
    .select("id,title,file_name,source_url,source_type,status,error_message,created_at,metadata")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <section>
      <h1 className="text-2xl font-black text-ink">Nguồn</h1>
      <div className="mt-5 space-y-3">
        {(sources || []).map((source) => (
          <Link key={source.id} href={`/sources/${source.id}`} className="block rounded-lg border border-line bg-white p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-black text-ink">{source.title || source.file_name || source.source_url}</h2>
                <p className="mt-1 text-xs font-semibold uppercase text-ink/50">{source.source_type}</p>
              </div>
              <StatusPill status={source.status} />
            </div>
            {source.error_message ? <p className="mt-3 text-sm text-clay">{source.error_message}</p> : null}
          </Link>
        ))}
        {!sources?.length ? <p className="rounded-lg border border-line bg-white p-4 text-sm text-ink/60">Chưa có nguồn nào.</p> : null}
      </div>
    </section>
  );
}
