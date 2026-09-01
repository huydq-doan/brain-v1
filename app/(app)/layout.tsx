import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { PwaRegister } from "@/components/pwa-register";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <>
      <PwaRegister />
      <main className="mx-auto min-h-screen w-full max-w-xl px-4 pb-24 pt-5">{children}</main>
      <BottomNav />
    </>
  );
}
