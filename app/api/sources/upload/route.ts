import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { processDocument } from "@/lib/processing/source";

const maxBytes = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Bạn cần chọn tệp." }, { status: 400 });
  if (file.size > maxBytes) return NextResponse.json({ error: "Tệp lớn hơn 10MB." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

  const upload = await supabase.storage.from("brain-sources").upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

  const { data: spaceId, error: spaceError } = await supabase.rpc("ensure_default_space");
  if (spaceError) return NextResponse.json({ error: spaceError.message }, { status: 500 });

  const { data: document, error } = await supabase
    .from("source_documents")
    .insert({
      space_id: spaceId,
      user_id: user.id,
      source_type: "file",
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      storage_path: storagePath,
      title: formData.get("title")?.toString() || file.name,
      status: "uploaded",
      metadata: { size: file.size }
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const result = await processDocument(supabase, document.id, buffer);
    return NextResponse.json({ id: document.id, status: result.status, warning: result.warning });
  } catch (processError) {
    return NextResponse.json(
      { id: document.id, status: "failed", error: processError instanceof Error ? processError.message : "Không xử lý được nguồn." },
      { status: 422 }
    );
  }
}
