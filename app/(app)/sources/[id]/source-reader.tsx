type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string };

function cleanText(value: string) {
  return value
    .replace(/^---\s*/, "")
    .replace(/\s*---\s*/g, "\n")
    .replace(/\s+(#{1,6})\s+/g, "\n$1 ")
    .replace(/\s+(Điều\s+\d+[a-zA-Z]?\.?\s+)/g, "\n### $1")
    .replace(/\s+(Khoản\s+\d+\s+)/g, "\n#### $1")
    .replace(/\s+(Điểm\s+[a-zđ]\s+)/gi, "\n##### $1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitBlocks(raw: string): Block[] {
  const cleaned = cleanText(raw);
  const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks: Block[] = [];

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s*(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      continue;
    }
    blocks.push({ type: "paragraph", text: line });
  }
  return blocks;
}

function headingClass(level: number) {
  if (level <= 2) return "mt-8 border-b border-line pb-2 text-xl font-black text-ink";
  if (level === 3) return "mt-6 text-base font-black text-ink";
  if (level === 4) return "mt-4 text-sm font-black text-ink";
  return "mt-3 text-sm font-bold text-ink/80";
}

export function SourceReader({ rawText }: { rawText: string }) {
  const blocks = splitBlocks(rawText);
  if (!blocks.length) {
    return <p className="text-sm text-ink/60">Chưa có nội dung đọc được.</p>;
  }

  const headings = blocks.filter((block): block is Extract<Block, { type: "heading" }> => block.type === "heading" && block.level <= 3);

  return (
    <div className="space-y-4">
      {headings.length > 2 ? (
        <details className="rounded-lg border border-line bg-mist px-4 py-3">
          <summary className="cursor-pointer text-sm font-black text-ink">Mục lục nhanh ({headings.length})</summary>
          <div className="mt-3 grid gap-2 text-sm text-ink/65 sm:grid-cols-2">
            {headings.slice(0, 24).map((heading, index) => (
              <p key={`${heading.text}-${index}`} className={heading.level === 3 ? "pl-3" : "font-bold text-ink/80"}>
                {heading.text}
              </p>
            ))}
          </div>
        </details>
      ) : null}

      <article className="rounded-xl border border-line bg-white px-5 py-5 shadow-soft sm:px-7 sm:py-6">
        <div className="mx-auto max-w-3xl">
          {blocks.map((block, index) => {
            if (block.type === "heading") {
              return <h3 key={index} className={headingClass(block.level)}>{block.text}</h3>;
            }
            return <p key={index} className="mt-3 text-[15px] leading-7 text-ink/75">{block.text}</p>;
          })}
        </div>
      </article>
    </div>
  );
}
