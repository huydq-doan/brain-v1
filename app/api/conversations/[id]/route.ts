import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const { data, error } = await supabase
    .from("conversations")
    .select("id,title,created_at,updated_at,messages(id,role,content,citations,metadata,created_at)")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ conversation: data });
}
