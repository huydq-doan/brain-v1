export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "ready"
      ? "bg-moss text-leaf"
      : status === "failed" || status === "needs_review"
        ? "bg-clay/10 text-clay"
        : "bg-ink/10 text-ink";
  return <span className={`rounded px-2 py-1 text-xs font-bold ${tone}`}>{status}</span>;
}
