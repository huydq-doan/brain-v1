# BRAIN V1

PWA mobile-first theo loi hua san pham: "Quang moi thu vao. AI hieu, nho va tim lai cho ban."

Nguoi dung chi can: Quang vao -> Hoi -> Xem lai.

## Stack

- Next.js App Router, TypeScript, Tailwind
- Supabase Auth, Postgres, Storage, RLS, pgvector
- OpenAI-compatible chat + embeddings API
- PWA manifest + service worker

## Local Setup

1. Tao Supabase project.
2. Bat extension `vector`.
3. Chay SQL trong `supabase/migrations/0001_brain_v1.sql`.
4. Tao `.env.local` tu `.env.example`.
5. Chay app:

```bash
npm install
npm run dev
```

Mo `http://localhost:3000`.

## Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

`OPENAI_API_KEY` chi duoc dung server-side. Khong dua service-role key vao client.

## Supabase

Migration tao:

- user-owned tables: profiles, spaces, source_documents, document_chunks, knowledge_items, knowledge_sources, knowledge_links, conversations, messages, knowledge_history, processing_jobs
- RLS cho moi bang du lieu user
- private storage bucket `brain-sources`
- storage policies theo folder dau tien la `auth.uid()`
- pgvector indexes va RPC `match_document_chunks`, `match_knowledge_items`
- default space cho moi user

## Deploy

1. Push source len Git provider.
2. Tao app tren Vercel hoac host Next.js tuong duong.
3. Set env vars nhu tren.
4. Chay migration tren Supabase production.
5. Deploy command: `npm run build`.
6. Start command: `npm run start`.

Build script dung webpack (`next build --webpack`) vi Turbopack cua Next 16 bi gioi han bind port trong moi truong sandbox hien tai.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm audit --audit-level=high
```

## V1 Limits

- Processing dang chay synchronous trong API route; production nen dua sang background queue khi tai lieu lon hon.
- URL ingestion chi doc mot URL duoc dan, khong crawl website.
- PDF/DOCX extraction phu thuoc text layer cua file; scan image PDF can OCR o ban sau.
- Rerank hien la retrieval theo pgvector + context LLM, chua co cross-encoder reranker rieng.
- Khong co service-role client-side; server route cung dung user session de RLS kiem soat.
