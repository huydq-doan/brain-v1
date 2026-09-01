"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SourceActions({ sourceId, sourceTitle }: { sourceId: string; sourceTitle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function removeSource() {
    const confirmed = window.confirm(`Xóa tài liệu nguồn “${sourceTitle}”?\n\nNguồn này sẽ không còn được dùng để tìm kiếm và trả lời. Hành động này không thể hoàn tác từ giao diện.`);
    if (!confirmed) return;

    setBusy(true);
    setError("");
    const response = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusy(false);
      setError(result.error || "Không xóa được tài liệu nguồn.");
      return;
    }

    router.push("/sources");
    router.refresh();
  }

  return (
    <div className="mt-5 rounded-lg border border-clay/20 bg-clay/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-ink">Quản lý nguồn</p>
          <p className="mt-1 text-xs leading-5 text-ink/55">Xóa nguồn khỏi BRAIN khi tài liệu bị trùng, sai hoặc không còn cần dùng.</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={removeSource}
          className="shrink-0 rounded-md border border-clay/30 bg-white px-3 py-2 text-sm font-black text-clay disabled:opacity-50"
        >
          {busy ? "Đang xóa..." : "Xóa nguồn"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-clay">{error}</p> : null}
    </div>
  );
}
