# Acceptance Results

Ngay kiem: 2026-08-31.

## Da chay trong repo

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run test`: PASS, 7 tests
- `npm run build`: PASS voi `next build --webpack`
- `npm audit --audit-level=high`: PASS, 0 vulnerabilities
- Smoke local dev: PASS
  - `/login`: 200
  - `/ask`: 307 -> `/login` khi chua auth
  - `/api/health`: `{"ok":true,"supabaseConfigured":false,"aiConfigured":false}`

## AT-01 den AT-13

| ID | Ket qua | Ghi chu |
| --- | --- | --- |
| AT-01 RLS user A khong doc user B | PARTIAL | Migration bat RLS va policy `auth.uid() = user_id`; can Supabase project that de test hai user. |
| AT-02 PDF upload parse ready | NOT RUN | Can Supabase + OPENAI_API_KEY. Code path co upload storage, pdf-parse, chunk, embed, analyze. |
| AT-03 File loi fail gracefully | PARTIAL | API bat loi va ghi `failed` + `processing_jobs.error_message`; can E2E voi file loi. |
| AT-04 Source ro tao Knowledge traceable | NOT RUN | Can LLM key; `knowledge_sources` map document/chunk/excerpt. |
| AT-05 Source thu hai update/link | NOT RUN | Reconciler co CREATE/UPDATE/NO_CHANGE/CONFLICT, can E2E LLM. |
| AT-06 Mau thuan khong overwrite am tham | NOT RUN | CONFLICT set `needs_review`, giu evidence cu; can E2E LLM. |
| AT-07 Cau hoi co answer + citation | NOT RUN | Ask API retrieve chunk/knowledge va tra citation document/chunk/excerpt. |
| AT-08 Cau hoi thieu evidence noi ro | PARTIAL | Code tra "Chua du can cu..." khi retrieval rong. |
| AT-09 Multi-source synthesis | NOT RUN | Can multi-source Supabase data + LLM. |
| AT-10 Luu thanh tri thuc | NOT RUN | API tao/update knowledge va preserve citations; can E2E. |
| AT-11 390x844 mobile usable | PARTIAL | UI mobile-first, no fixed wide layout; smoke server pass, chua screenshot E2E vi chua co Supabase/env. |
| AT-12 Persist after reopen | PARTIAL | Data persisted in Supabase tables; can browser E2E. |
| AT-13 Manual access user B doc 403/404 | PARTIAL | RLS-backed select returns not found; can Supabase two-user E2E. |

## Can chay khi co credentials

1. Apply migration tren Supabase.
2. Set `.env.local`.
3. Tao hai user test.
4. Upload PDF/TXT/DOCX, link, note.
5. Chay cac scenario AT-01 den AT-13 tren app thật.
