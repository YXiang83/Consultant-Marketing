import { AuthForm } from "@/features/auth/AuthForm";

export default function RegisterPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-8 text-sm text-neutral-500">Start with 10 free copy generations.</p>
      <AuthForm mode="register" />
    </div>
  );
}
