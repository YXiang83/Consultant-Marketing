"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 18_000);

    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; next?: string; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "The password could not be updated.");
      }
      window.location.assign(payload.next || "/membership-status");
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "The request took too long. Please try again."
          : err instanceof Error
            ? err.message
            : "The password could not be updated.",
      );
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Consultant Marketing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Set a new password</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Use at least 8 characters. This page works only after opening a valid recovery link.
          </p>
        </header>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirmation">Confirm new password</Label>
            <Input
              id="confirmation"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {error && (
            <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <Button type="submit" size="block" loading={loading}>
            Update password
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-600">
          <Link href="/login" className="underline">Back to log in</Link>
        </p>
      </div>
    </main>
  );
}
