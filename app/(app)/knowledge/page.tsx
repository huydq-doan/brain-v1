import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("knowledge_items")
    .select("id,title,item_type,short_summary,confidence,status,updated_at,knowledge_sources(id)")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (params.type && params.type !== "all") query = query.eq("item_type", params.type);
  if (params.q) query = query.or(`title.ilike.%${params.q}%,short_summary.ilike.%${params.q}%`);
  const { data: items } = await query;

  return (
    <section>
      <h1 className="text-2xl font-black text-ink">Tri thức</h1>
      <form className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <input
          name="q"
          defaultValue={params.q || ""}
          placeholder="Tìm tri thức"
          className="h-11 min-w-0 rounded-md border border-line bg-white px-3 outline-none focus:border-leaf"
        />
        <button className="h-11 rounded-md bg-ink px-4 text-sm font-bold text-white">Tìm</button>
      </form>
      <div className="mt-5 space-y-3">
        {(items || []).map((item) => (
          <Link key={item.id} href={`/knowledge/${item.id}`} className="block rounded-lg border border-line bg-white p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-base font-black text-ink">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink/65">{item.short_summary}</p>
              </div>
              <StatusPill status={item.status} />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase text-ink/45">
              {item.item_type} · {item.knowledge_sources?.length || 0} nguồn · {Number(item.confidence).toFixed(2)}
            </p>
          </Link>
        ))}
        {!items?.length ? <p className="rounded-lg border border-line bg-white p-4 text-sm text-ink/60">Chưa có tri thức nào.</p> : null}
      </div>
    </section>
  );
}
