import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    aiConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
}
