"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "file" | "url" | "text";

export function AddSource() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("file");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Đang tải");
    let response: Response;
    if (mode === "file") {
      if (!file) {
        setBusy(false);
        setMessage("Hãy chọn tệp.");
        return;
      }
      const data = new FormData();
      data.set("file", file);
      if (title) data.set("title", title);
      setMessage("Đang đọc");
      response = await fetch("/api/sources/upload", { method: "POST", body: data });
    } else if (mode === "url") {
      setMessage("Đang đọc");
      response = await fetch("/api/sources/url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, title })
      });
    } else {
      setMessage("Đang tạo tri thức");
      response = await fetch("/api/sources/text", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, title })
      });
    }
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error || "Không xử lý được nguồn này.");
      return;
    }
    setMessage(result.warning ? `Đã lưu nguồn. ${result.warning}` : "Hoàn tất");
    router.push(`/sources/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded-md bg-white p-1 shadow-soft">
        {[
          ["file", "Tài liệu"],
          ["url", "Dán link"],
          ["text", "Ghi chú"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value as Mode)}
            className={`h-11 rounded-md text-sm font-bold ${mode === value ? "bg-ink text-white" : "text-ink/70"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Tiêu đề"
        className="h-12 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-leaf"
      />
      {mode === "file" ? (
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          className="w-full rounded-md border border-line bg-white p-3 text-sm"
        />
      ) : null}
      {mode === "url" ? (
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://..."
          type="url"
          required
          className="h-12 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-leaf"
        />
      ) : null}
      {mode === "text" ? (
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Dán nội dung vào đây"
          required
          rows={10}
          className="w-full resize-none rounded-md border border-line bg-white p-3 leading-6 outline-none focus:border-leaf"
        />
      ) : null}
      {message ? <p className="text-sm font-semibold text-ink/70">{message}</p> : null}
      <button disabled={busy} className="h-12 w-full rounded-md bg-leaf font-bold text-white disabled:opacity-60">
        {busy ? "Đang xử lý" : "Lưu nguồn"}
      </button>
    </form>
  );
}
