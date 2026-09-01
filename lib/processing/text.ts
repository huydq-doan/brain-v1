export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeText(text: string) {
  return text.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function estimateTokens(text: string) {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.35);
}

export function excerpt(text: string, max = 360) {
  const clean = cleanEvidenceText(text);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}...`;
}

export function cleanEvidenceText(text: string) {
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreLegalEvidence(question: string, content: string, baseSimilarity = 0) {
  const q = question.toLowerCase();
  const c = content.toLowerCase();
  let score = baseSimilarity;

  for (const token of q.split(/\s+/).filter((part) => part.length > 2)) {
    if (c.includes(token)) score += 0.015;
  }
  if (/điều\s+\d+|khoản\s+\d+|mục\s+\d+/i.test(content)) score += 0.12;
  if (/luật|nghị định|thông tư|đấu thầu|quy định/i.test(content)) score += 0.08;
  if (/là gì|khái niệm|định nghĩa/i.test(q) && /là|được hiểu là|hình thức|khái niệm/i.test(content)) score += 0.08;
  if (/đấu thầu rộng rãi/i.test(q) && /điều\s+21|đấu thầu rộng rãi/i.test(content)) score += 0.2;

  return score;
}

export function chunkText(text: string, targetTokens = 900, overlapTokens = 130) {
  const paragraphs = normalizeText(text)
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    const tokens = estimateTokens(paragraph);
    if (currentTokens + tokens > targetTokens && current.length) {
      chunks.push(current.join("\n\n"));
      const words = current.join(" ").split(/\s+/);
      current = [words.slice(Math.max(0, words.length - overlapTokens)).join(" ")];
      currentTokens = estimateTokens(current[0]);
    }
    if (tokens > targetTokens * 1.5) {
      const words = paragraph.split(/\s+/);
      for (let i = 0; i < words.length; i += targetTokens - overlapTokens) {
        chunks.push(words.slice(i, i + targetTokens).join(" "));
      }
      current = [];
      currentTokens = 0;
    } else {
      current.push(paragraph);
      currentTokens += tokens;
    }
  }

  if (current.length) chunks.push(current.join("\n\n"));
  return chunks.filter((chunk) => chunk.trim().length > 0);
}

export async function extractFileText(buffer: Buffer, mimeType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  if (mimeType.includes("pdf") || lower.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return normalizeText(result.text);
  }
  if (
    mimeType.includes("wordprocessingml.document") ||
    mimeType.includes("msword") ||
    lower.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return normalizeText(result.value);
  }
  if (
    mimeType.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown")
  ) {
    return normalizeText(buffer.toString("utf8"));
  }
  throw new Error("Định dạng chưa hỗ trợ. V1 hỗ trợ PDF, DOCX, TXT và MD.");
}

export async function fetchUrlText(url: string) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Chỉ hỗ trợ URL http hoặc https.");
  }
  const response = await fetch(parsed.toString(), {
    headers: { "user-agent": "BRAIN-V1/1.0" }
  });
  if (!response.ok) {
    throw new Error(`Không đọc được URL, mã lỗi ${response.status}.`);
  }
  const contentType = response.headers.get("content-type") || "";
  const body = Buffer.from(await response.arrayBuffer());
  if (contentType.includes("pdf") || parsed.pathname.toLowerCase().endsWith(".pdf")) {
    return extractFileText(body, contentType, parsed.pathname);
  }
  return stripHtml(body.toString("utf8"));
}
