## M0 — Skeleton
Next.js/TS, Supabase, auth, protected routes, PWA shell.
EXIT: login và empty app chạy.

## M1 — Source ingestion
DB source, storage, upload, URL/text, source list/status.
EXIT: nguồn gốc được lưu an toàn.

## M2 — Parsing + chunks
Extract text, chunk, processing_jobs.
EXIT: source detail có text preview.

## M3 — Embeddings + retrieval
pgvector, embedding pipeline, similarity query.
EXIT: test retrieval tìm đúng chunks.

## M4 — Knowledge builder
Analyzer, reconciliation, items, sources, links, history.
EXIT: upload tạo Knowledge Items truy nguồn được.

## M5 — Knowledge UI
List/search/detail/sources/related/edit.
EXIT: duyệt tri thức được.

## M6 — Ask
Retrieval, context, LLM, citations, conversations.
EXIT: hỏi và nhận grounded answer.

## M7 — Save insight
Save answer as knowledge, duplicate check, citations.
EXIT: answer trở thành reusable knowledge.

## M8 — Hardening
Retry, errors, RLS review, rate limit, logging, tests, mobile polish.
EXIT: AT-01 → AT-13 PASS.

Không chuyển milestone nếu EXIT hiện tại chưa đạt.
""",

