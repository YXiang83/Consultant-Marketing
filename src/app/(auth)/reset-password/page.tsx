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

  async function onSubmit(event: React.FormEvent) {
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
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mb-8 text-sm leading-6 text-neutral-500">
        Open this page from a valid recovery email, then choose a password with at least 8 characters.
      </p>
      <form className="space-y-4" onSubmit={onSubmit}>
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
  );
}
