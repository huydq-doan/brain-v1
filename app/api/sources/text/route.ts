import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { processDocument } from "@/lib/processing/source";

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const body = await request.json().catch(() => null);
  const text = String(body?.text || "").trim();
  const title = String(body?.title || "Ghi chú").trim();
  if (text.length < 10) return NextResponse.json({ error: "Ghi chú quá ngắn." }, { status: 400 });

  const { data: spaceId, error: spaceError } = await supabase.rpc("ensure_default_space");
  if (spaceError) return NextResponse.json({ error: spaceError.message }, { status: 500 });

  const { data: document, error } = await supabase
    .from("source_documents")
    .insert({
      space_id: spaceId,
      user_id: user.id,
      source_type: "text",
      title,
      raw_text: text,
      status: "uploaded"
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const result = await processDocument(supabase, document.id);
    return NextResponse.json({ id: document.id, status: result.status, warning: result.warning });
  } catch (processError) {
    return NextResponse.json(
      { id: document.id, status: "failed", error: processError instanceof Error ? processError.message : "Không xử lý được nguồn." },
      { status: 422 }
    );
  }
}
