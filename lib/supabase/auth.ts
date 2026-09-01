import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { supabase, user: null, response: NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 }) };
  }
  return { supabase, user: data.user, response: null };
}
