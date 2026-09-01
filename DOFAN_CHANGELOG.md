# BRAIN V1 — Dofan patch 2026-09-01

## Mục tiêu
Sửa Answer Engine để BRAIN trả lời đúng ý định, đúng độ sâu và không phơi dữ liệu kỹ thuật ra giao diện.

## Đã sửa
- Thêm `ANSWER_FAST`: chế độ Nhanh nay thực sự ngắn, dùng Terra với reasoning/verbosity thấp và ngân sách output nhỏ hơn.
- Tách rõ `Nhanh / Chuẩn / Chuyên sâu` ở cả model routing, retrieval budget và post-processing.
- Thêm nhận diện intent cục bộ: `source_list`, `definition`, `lookup`, `compare`, `analysis`.
- Câu hỏi kiểu “liệt kê tài liệu nguồn” đi đường deterministic, không cần gọi LLM và không xổ document_id/evidence.
- Prompt trả lời chuyển từ “mọi câu đều phải phân tích sâu” sang “đúng câu hỏi, chỉ mở rộng khi cần”.
- Chế độ Nhanh: tối đa 1 section, không tự thêm kết luận thực hành.
- Chế độ Chuẩn: tối đa 4 section; Chuyên sâu: tối đa 8 section.
- Giảm retrieval cho Nhanh; tăng dần cho Chuẩn/Chuyên sâu.
- Dedupe citation theo tên nguồn hiển thị, giới hạn số nguồn theo mode.
- Sanitize output để chặn `document_id`, `chunk_id`, markdown thô và thuật ngữ nội bộ `evidence` lọt ra giao diện.
- Thay số `Độ tin cậy 0.xx` bằng nhãn dễ hiểu: `Căn cứ mạnh / Căn cứ khá / Căn cứ hạn chế`.
- Thêm unit test cho intent và answer routing.

## File thay đổi
- `lib/ai/router.ts`
- `lib/processing/knowledge.ts`
- `app/(app)/ask/ask-client.tsx`
- `tests/unit/router.test.ts` (mới)

## Kiểm tra đã thực hiện trong môi trường sửa
- Syntax transpile TypeScript/TSX cho 4 file thay đổi: PASS.
- Full `npm test/typecheck/lint/build`: chưa chạy được trong container vì dependencies không thể cài hoàn chỉnh trong phiên làm việc này. Cần chạy trên máy local trước khi push.

## Lệnh kiểm tra trên máy Mac
```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Nếu tất cả PASS:
```bash
git add .
git commit -m "Improve BRAIN answer routing and response quality"
git push
```
Vercel sẽ tự deploy branch `main`.
