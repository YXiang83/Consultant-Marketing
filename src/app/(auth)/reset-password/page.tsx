"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password });
      if (error) throw error;
      router.replace("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Open this page from the email link. Then choose a new password.
      </p>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
    </div>
  );
}
