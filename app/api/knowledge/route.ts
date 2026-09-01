import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const type = url.searchParams.get("type")?.trim();
  let query = supabase
    .from("knowledge_items")
    .select("id,title,item_type,short_summary,body,confidence,status,created_by,created_at,updated_at,knowledge_sources(id)")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (type && type !== "all") query = query.eq("item_type", type);
  if (q) query = query.or(`title.ilike.%${q}%,short_summary.ilike.%${q}%,body.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ knowledge: data });
}
