"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register" | "forgot";

type AuthPayload = {
  ok?: boolean;
  next?: string | null;
  message?: string;
  error?: string;
};

async function postAuth(path: string, body: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as AuthPayload | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "The request could not be completed.");
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
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
        const payload = await postAuth("/api/auth/login", { email, password, next });
        window.location.assign(payload.next || "/home");
        return;
      }

      const origin = window.location.origin;
      if (mode === "register") {
        const payload = await postAuth("/api/auth/register", {
          email,
          password,
          name,
          origin,
        });
        if (payload.next) {
          window.location.assign(payload.next);
          return;
        }
        setInfo(payload.message || "Check your email to confirm your account, then log in.");
      } else {
        const payload = await postAuth("/api/auth/password-reset", { email, origin });
        setInfo(payload.message || "If an account exists, we've sent a reset link.");
      }
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "The request took too long. Please try again."
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
