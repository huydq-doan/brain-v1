import { AddSource } from "./source-form";

export default function AddPage() {
  return (
    <section>
      <h1 className="text-2xl font-black text-ink">Quăng vào</h1>
      <p className="mt-2 text-sm leading-6 text-ink/65">Tài liệu, link hoặc ghi chú. BRAIN sẽ đọc và tạo tri thức có căn cứ.</p>
      <AddSource />
    </section>
  );
}
