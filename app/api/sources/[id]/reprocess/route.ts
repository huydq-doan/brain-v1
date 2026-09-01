import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { processDocument } from "@/lib/processing/source";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  try {
    const result = await processDocument(supabase, id);
    return NextResponse.json({ id, status: result.status, warning: result.warning });
  } catch (error) {
    return NextResponse.json({ id, status: "failed", error: error instanceof Error ? error.message : "Không xử lý được nguồn." }, { status: 422 });
  }
}
