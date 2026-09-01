import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-8">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-wide text-leaf">BRAIN V1</p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-ink">Quăng mọi thứ vào.</h1>
        <p className="mt-3 text-base leading-7 text-ink/70">AI hiểu, nhớ và tìm lại cho bạn.</p>
      </div>
      <LoginForm />
    </main>
  );
}
