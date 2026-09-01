create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('file', 'url', 'text')),
  file_name text,
  mime_type text,
  source_url text,
  storage_path text,
  title text,
  raw_text text,
  status text not null default 'uploaded' check (status in ('uploaded', 'parsing', 'analyzing', 'ready', 'failed')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.source_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer not null default 0,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null,
  item_type text not null default 'other' check (item_type in ('concept','person','organization','event','timeline','rule','decision','case','summary','insight','other')),
  short_summary text not null default '',
  body text not null default '',
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  status text not null default 'active' check (status in ('active', 'needs_review', 'archived')),
  created_by text not null default 'ai' check (created_by in ('ai', 'user', 'saved_answer')),
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  document_id uuid not null references public.source_documents(id) on delete cascade,
  chunk_id uuid references public.document_chunks(id) on delete set null,
  quote_text text not null default '',
  relevance numeric not null default 0.5,
  created_at timestamptz not null default now(),
  unique(knowledge_item_id, document_id, chunk_id)
);

create table if not exists public.knowledge_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  to_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  relation_type text not null check (relation_type in ('related_to','supports','contradicts','depends_on','part_of','causes','updates','example_of')),
  explanation text not null default '',
  confidence numeric not null default 0.5,
  created_at timestamptz not null default now(),
  unique(from_item_id, to_item_id, relation_type)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null default 'Hoi BRAIN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_history (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  change_type text not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.source_documents(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  attempts integer not null default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sources_user_status on public.source_documents(user_id, status) where deleted_at is null;
create index if not exists idx_chunks_user_doc on public.document_chunks(user_id, document_id);
create index if not exists idx_knowledge_user_status on public.knowledge_items(user_id, status) where deleted_at is null;
create index if not exists idx_knowledge_sources_item on public.knowledge_sources(knowledge_item_id);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at);
create index if not exists idx_chunks_embedding on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_knowledge_embedding on public.knowledge_items using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists touch_spaces_updated_at on public.spaces;
create trigger touch_spaces_updated_at before update on public.spaces for each row execute function public.touch_updated_at();
drop trigger if exists touch_sources_updated_at on public.source_documents;
create trigger touch_sources_updated_at before update on public.source_documents for each row execute function public.touch_updated_at();
drop trigger if exists touch_knowledge_updated_at on public.knowledge_items;
create trigger touch_knowledge_updated_at before update on public.knowledge_items for each row execute function public.touch_updated_at();
drop trigger if exists touch_conversations_updated_at on public.conversations;
create trigger touch_conversations_updated_at before update on public.conversations for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.spaces(user_id, name)
  values (new.id, 'Default')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.ensure_default_space()
returns uuid language plpgsql security invoker as $$
declare
  space uuid;
begin
  select id into space from public.spaces where user_id = auth.uid() order by created_at asc limit 1;
  if space is null then
    insert into public.spaces(user_id, name) values (auth.uid(), 'Default') returning id into space;
  end if;
  return space;
end;
$$;

create or replace function public.match_document_chunks(query_embedding vector(1536), match_count int default 8)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  metadata jsonb
) language sql stable security invoker as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity,
    dc.metadata
  from public.document_chunks dc
  join public.source_documents sd on sd.id = dc.document_id
  where dc.user_id = auth.uid()
    and sd.deleted_at is null
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_knowledge_items(query_embedding vector(1536), match_count int default 8)
returns table (
  id uuid,
  title text,
  item_type text,
  short_summary text,
  body text,
  similarity float
) language sql stable security invoker as $$
  select
    ki.id,
    ki.title,
    ki.item_type,
    ki.short_summary,
    ki.body,
    1 - (ki.embedding <=> query_embedding) as similarity
  from public.knowledge_items ki
  where ki.user_id = auth.uid()
    and ki.deleted_at is null
    and ki.status <> 'archived'
    and ki.embedding is not null
  order by ki.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.source_documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_links enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.knowledge_history enable row level security;
alter table public.processing_jobs enable row level security;

create policy "profiles own rows" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "spaces own rows" on public.spaces for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sources own rows" on public.source_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chunks own rows" on public.document_chunks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "knowledge own rows" on public.knowledge_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "links own rows" on public.knowledge_links for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "conversations own rows" on public.conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "messages own rows" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "history own rows" on public.knowledge_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "jobs own rows" on public.processing_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "knowledge sources via owned knowledge" on public.knowledge_sources
for all using (
  exists (
    select 1 from public.knowledge_items ki
    where ki.id = knowledge_sources.knowledge_item_id and ki.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.knowledge_items ki
    where ki.id = knowledge_sources.knowledge_item_id and ki.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('brain-sources', 'brain-sources', false)
on conflict (id) do nothing;

create policy "storage read own source files" on storage.objects
for select using (
  bucket_id = 'brain-sources'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "storage insert own source files" on storage.objects
for insert with check (
  bucket_id = 'brain-sources'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "storage update own source files" on storage.objects
for update using (
  bucket_id = 'brain-sources'
  and auth.uid()::text = (storage.foldername(name))[1]
) with check (
  bucket_id = 'brain-sources'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "storage delete own source files" on storage.objects
for delete using (
  bucket_id = 'brain-sources'
  and auth.uid()::text = (storage.foldername(name))[1]
);
