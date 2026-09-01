"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    router.replace("/ask");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-mist p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`h-10 rounded-md text-sm font-bold ${mode === "signin" ? "bg-ink text-white" : "text-ink/70"}`}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`h-10 rounded-md text-sm font-bold ${mode === "signup" ? "bg-ink text-white" : "text-ink/70"}`}
        >
          Tạo tài khoản
        </button>
      </div>
      <label className="block text-sm font-bold text-ink" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-2 h-12 w-full rounded-md border border-line px-3 outline-none focus:border-leaf"
      />
      <label className="mt-4 block text-sm font-bold text-ink" htmlFor="password">
        Mật khẩu
      </label>
      <input
        id="password"
        type="password"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        required
        minLength={6}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-2 h-12 w-full rounded-md border border-line px-3 outline-none focus:border-leaf"
      />
      {message ? <p className="mt-3 text-sm text-clay">{message}</p> : null}
      <button
        disabled={busy}
        className="mt-5 h-12 w-full rounded-md bg-leaf font-bold text-white disabled:opacity-60"
      >
        {busy ? "Đang xử lý" : mode === "signin" ? "Vào BRAIN" : "Tạo BRAIN"}
      </button>
    </form>
  );
}
