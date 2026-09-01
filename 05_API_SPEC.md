## Sources
POST /api/sources/upload
POST /api/sources/url
POST /api/sources/text
GET /api/sources
GET /api/sources/:id
POST /api/sources/:id/reprocess
DELETE /api/sources/:id

## Knowledge
GET /api/knowledge
GET /api/knowledge/:id
PATCH /api/knowledge/:id
DELETE /api/knowledge/:id

## Ask
POST /api/ask
Input:
{ "conversation_id": null, "question": "..." }

Output:
{
  "conversation_id": "...",
  "answer": "...",
  "citations": [
    {
      "document_id": "...",
      "document_title": "...",
      "chunk_id": "...",
      "excerpt": "..."
    }
  ],
  "confidence": 0.86
}

GET /api/conversations
GET /api/conversations/:id

## Save Insight
POST /api/messages/:id/save-as-knowledge

## Processing
GET /api/jobs/:document_id

## Health
GET /api/health
""",

