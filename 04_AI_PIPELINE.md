## Ingestion
1. Nhận file/URL/text.
2. Lưu nguồn gốc.
3. Extract text.
4. Chunk khoảng 700–1200 tokens, overlap 100–150.
5. Tạo embedding.
6. AI phân tích: title, summary, topics, entities, dates, events, rules, candidate knowledge, relations.
7. Reconcile với tri thức hiện có.
8. Create/update/link; mâu thuẫn thì needs_review.
9. Source → ready.

## Knowledge reconciliation
Với mỗi candidate:
- semantic search knowledge hiện có;
- không gần → CREATE;
- cùng khái niệm + bổ sung → UPDATE;
- không thay đổi → NO_CHANGE;
- xung đột → CONFLICT.
Không bao giờ xóa evidence cũ.

## Ask
Question → embedding → retrieve Knowledge + chunks → rerank → context → LLM → answer + citations → lưu conversation.

Nếu không đủ evidence: nói rõ “chưa đủ căn cứ”.

## Save answer
Answer → chuẩn hóa thành reusable knowledge → giữ citations → duplicate check → create/update → history.

## Confidence
0.90–1.00: nhiều nguồn mạnh đồng thuận.
0.75–0.89: một nguồn trực tiếp mạnh.
0.50–0.74: evidence gián tiếp/thiếu.
<0.50: needs_review.

## Cost
Hash source, không re-embed phần không đổi, batch embeddings, model nhỏ cho extraction, model mạnh cho synthesis/reconciliation.
""",

