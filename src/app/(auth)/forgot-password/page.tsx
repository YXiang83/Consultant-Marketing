import { AuthForm } from "@/features/auth/AuthForm";

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mb-8 text-sm text-neutral-500">Enter your email and we&apos;ll send a link.</p>
      <AuthForm mode="forgot" />
    </div>
  );
}
