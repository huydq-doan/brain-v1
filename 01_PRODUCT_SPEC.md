## Product statement
Một “bộ não cá nhân AI” biến tài liệu rời rạc thành kho tri thức sống, có thể hỏi đáp và truy nguồn.

## Jobs
- Capture: quăng tài liệu vào nhanh.
- Understand: AI tự hiểu và bóc tri thức.
- Retrieve: hỏi bằng ngôn ngữ tự nhiên.
- Verify: biết câu trả lời dựa vào đâu.
- Accumulate: lưu insight mới trở lại bộ não.

## Chức năng
### Authentication
Supabase Auth; RLS bắt buộc.

### Add Source
PDF, DOCX, TXT/MD, URL, text note.
Trạng thái: uploaded → parsing → analyzing → ready/failed.

### Processing
Lưu file gốc → extract text → chunk → embedding → phân tích AI.

### Knowledge
Mỗi Knowledge Item gồm title, summary, body, type, confidence, sources, related items, created_by.

### Reconciliation
Nguồn mới gần tri thức cũ: cập nhật thay vì duplicate. Mâu thuẫn: giữ cả hai nguồn và đánh dấu cần xem xét.

### Ask
Tìm Knowledge Items + chunks liên quan → rerank → trả lời → citation.

### Save Answer
Nút “Lưu thành tri thức”; giữ citations và liên kết liên quan.

### Browse
Tri thức: list/search/filter/detail.
Nguồn: list/status/detail/reprocess.

## Phi chức năng
Mobile 360px+, private storage, signed URLs, RLS, retry jobs, logging, soft delete, không hardcode secrets.
""",

