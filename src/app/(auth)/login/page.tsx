import { AuthForm } from "@/features/auth/AuthForm";

export default function LoginPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Log in</h1>
      <p className="mb-8 text-sm text-neutral-500">Welcome back.</p>
      <AuthForm mode="login" />
    </div>
  );
}
