"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Mode = "login" | "register" | "forgot";

export function AuthForm(props: { mode: Mode }) {
  return (
    <Suspense fallback={<div className="text-sm text-neutral-500">Loading…</div>}>
      <AuthFormInner {...props} />
    </Suspense>
  );
}

function AuthFormInner({ mode }: { mode: Mode }) {
  const router = useRouter();
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
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = supabaseBrowser();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name } },
        });
        if (error) throw error;
        setInfo("Check your email to confirm your account, then log in.");
      } else {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/reset-password`,
        });
        if (error) throw error;
        setInfo("If an account exists, we've sent a reset link.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
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
