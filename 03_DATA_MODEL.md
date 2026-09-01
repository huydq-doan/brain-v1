"03_DATA_MODEL.md": """# BRAIN V1 — DATA MODEL

PostgreSQL/Supabase.

## profiles
id, display_name, created_at, updated_at.

## spaces
id, user_id, name, created_at, updated_at.
V1 mỗi user có một default space.

## source_documents
id, space_id, user_id, source_type(file/url/text), file_name, mime_type, source_url, storage_path, title, raw_text, status, error_message, metadata, created_at, updated_at, deleted_at.

## document_chunks
id, document_id, user_id, chunk_index, content, token_count, embedding(vector), metadata, created_at.

## knowledge_items
id, space_id, user_id, title, slug,
item_type(concept/person/organization/event/timeline/rule/decision/case/summary/insight/other),
short_summary, body, confidence, status(active/needs_review/archived),
created_by(ai/user/saved_answer), metadata, created_at, updated_at, deleted_at.

## knowledge_sources
id, knowledge_item_id, document_id, chunk_id, quote_text, relevance, created_at.

## knowledge_links
id, user_id, from_item_id, to_item_id,
relation_type(related_to/supports/contradicts/depends_on/part_of/causes/updates/example_of),
explanation, confidence, created_at.

## conversations
id, user_id, space_id, title, created_at, updated_at.

## messages
id, conversation_id, user_id, role, content, citations(jsonb), metadata, created_at.

## knowledge_history
id, knowledge_item_id, user_id, change_type, before_data, after_data, reason, created_at.

## processing_jobs
id, user_id, document_id, job_type, status, attempts, error_message, started_at, finished_at, created_at.

## RLS
Mọi bảng dữ liệu người dùng phải giới hạn auth.uid() = user_id.
Không dùng service-role key ở client.
""",

