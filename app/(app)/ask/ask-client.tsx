"use client";

import Link from "next/link";
import { useState } from "react";

type Citation = {
  claim?: string;
  document_id: string;
  document_title: string;
  section?: string;
  chunk_id: string | null;
  excerpt: string;
};

type AnswerSection = {
  heading: string;
  content: string;
};

type AnswerState = {
  conversation_id: string;
  message_id: string;
  direct_answer: string;
  sections: AnswerSection[];
  practical_conclusion: string;
  confidence: number;
  insufficient_evidence: boolean;
  citations: Citation[];
};

type AnswerMode = "fast" | "standard" | "deep";

function renderContent(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLines = lines.filter((line) => /^[-*•]\s+/.test(line));
  if (bulletLines.length >= 2 && bulletLines.length === lines.length) {
    return (
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-ink/75">
        {bulletLines.map((line, index) => (
          <li key={index}>{line.replace(/^[-*•]\s+/, "")}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mt-3 space-y-3 text-sm leading-7 text-ink/75">
      {lines.map((line, index) => (
        <p key={index}>{line.replace(/^#{1,6}\s*/, "")}</p>
      ))}
    </div>
  );
}

export function AskClient() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const [saved, setSaved] = useState("");
  const [mode, setMode] = useState<AnswerMode>("standard");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved("");
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, mode, conversation_id: answer?.conversation_id || null })
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(result.error || "Không trả lời được câu hỏi này.");
      return;
    }
    setAnswer(result);
  }

  async function saveAnswer() {
    if (!answer) return;
    setSaved("Đang lưu");
    const response = await fetch(`/api/messages/${answer.message_id}/save-as-knowledge`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSaved(result.error || "Không lưu được.");
      return;
    }
    setSaved("Đã lưu thành tri thức");
  }

  return (
    <div className="mt-5">
      <form onSubmit={submit}>
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-md bg-white p-1 shadow-soft">
          {[
            ["fast", "Nhanh"],
            ["standard", "Chuẩn"],
            ["deep", "Chuyên sâu"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value as AnswerMode)}
              className={`h-10 rounded-md text-sm font-bold ${mode === value ? "bg-ink text-white" : "text-ink/70"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Bạn muốn hỏi bộ não điều gì?"
          required
          rows={6}
          className="w-full resize-none rounded-lg border border-line bg-white p-4 text-lg leading-7 shadow-soft outline-none focus:border-leaf"
        />
        <button disabled={busy} className="mt-3 h-12 w-full rounded-md bg-leaf font-bold text-white disabled:opacity-60">
          {busy ? "Đang hỏi" : "Hỏi BRAIN"}
        </button>
      </form>
      {error ? <p className="mt-4 rounded-md bg-clay/10 p-3 text-sm text-clay">{error}</p> : null}
      {answer ? (
        <article className="mt-6 rounded-lg border border-line bg-white shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <p className="px-4 pt-4 text-xs font-bold uppercase text-ink/45">Độ tin cậy {answer.confidence.toFixed(2)}</p>
            <button onClick={saveAnswer} className="h-9 rounded-md bg-ink px-3 text-xs font-bold text-white">
              Lưu thành tri thức
            </button>
          </div>
          {answer.insufficient_evidence ? (
            <p className="mx-4 mt-4 rounded-md bg-clay/10 p-3 text-sm leading-6 text-clay">{answer.direct_answer}</p>
          ) : (
            <section className="px-4 pb-2 pt-4">
              <h2 className="text-sm font-black uppercase text-ink/50">Trả lời ngắn</h2>
              <p className="mt-2 text-lg font-bold leading-8 text-ink">{answer.direct_answer}</p>
            </section>
          )}
          {answer.sections.map((section, index) => (
            <section key={`${section.heading}-${index}`} className="border-t border-line px-4 py-4">
              <h2 className="text-base font-black text-ink">{section.heading}</h2>
              {renderContent(section.content)}
            </section>
          ))}
          {answer.practical_conclusion ? (
            <section className="border-t border-line bg-mist px-4 py-4">
              <h2 className="text-base font-black text-ink">Kết luận thực hành</h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-ink/75">{answer.practical_conclusion}</p>
            </section>
          ) : null}
          {answer.citations.length ? (
            <div className="border-t border-line px-4 py-4">
              <h2 className="text-sm font-black uppercase text-ink/60">Căn cứ</h2>
              <div className="mt-3 flex flex-col gap-2">
                {answer.citations.map((citation, index) => (
                  <Link
                    key={`${citation.document_id}-${citation.chunk_id}-${index}`}
                    href={`/sources/${citation.document_id}`}
                    className="rounded-md border border-line bg-mist p-3"
                  >
                    <p className="text-sm font-bold text-ink">{citation.document_title}</p>
                    {citation.claim ? <p className="mt-1 text-xs font-bold uppercase text-leaf">{citation.claim}</p> : null}
                    <p className="mt-1 text-sm leading-6 text-ink/65">{citation.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {saved ? <p className="px-4 pb-4 text-sm font-bold text-leaf">{saved}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
