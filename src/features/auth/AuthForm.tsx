"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Mode = "login" | "register" | "forgot";

async function withClientTimeout<T>(promise: Promise<T>, milliseconds = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("The request took too long. Please try again.")), milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function AuthForm(props: { mode: Mode }) {
  return (
    <Suspense fallback={<div className="text-sm text-neutral-500">Loading…</div>}>
      <AuthFormInner {...props} />
    </Suspense>
  );
}

function AuthFormInner({ mode }: { mode: Mode }) {
  const search = useSearchParams();
  const next = search.get("next") || "/home";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "login") {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 18_000);
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            signal: controller.signal,
            body: JSON.stringify({ email, password, next }),
          });
          const payload = (await response.json().catch(() => null)) as
            | { ok?: boolean; next?: string; error?: string }
            | null;
          if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || "Login could not be completed.");
          }
          window.location.assign(payload.next || "/home");
          return;
        } finally {
          window.clearTimeout(timer);
        }
      }

      const supabase = supabaseBrowser();
      if (mode === "register") {
        const { error: signUpError } = await withClientTimeout(
          supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: name } },
          }),
        );
        if (signUpError) throw signUpError;
        setInfo("Check your email to confirm your account, then log in.");
      } else {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const { error: resetError } = await withClientTimeout(
          supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${origin}/reset-password`,
          }),
        );
        if (resetError) throw resetError;
        setInfo("If an account exists, we've sent a reset link.");
      }
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "Login took too long. Please try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "register" && (
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </div>
      )}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          required
        />
      </div>
      {mode !== "forgot" && (
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {info && (
        <div role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {info}
        </div>
      )}

      <Button type="submit" size="block" loading={loading}>
        {mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Send reset link"}
      </Button>

      <div className="pt-1 text-center text-sm text-neutral-600">
        {mode === "login" && (
          <>
            <Link href="/forgot-password" className="underline">
              Forgot password?
            </Link>
            <span className="mx-2 text-neutral-300">•</span>
            <Link href="/register" className="underline">
              Create account
            </Link>
          </>
        )}
        {mode === "register" && (
          <Link href="/login" className="underline">
            Already have an account? Log in
          </Link>
        )}
        {mode === "forgot" && (
          <Link href="/login" className="underline">
            Back to log in
          </Link>
        )}
      </div>
    </form>
  );
}
