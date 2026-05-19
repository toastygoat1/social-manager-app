"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ChallengeForm() {
  const router = useRouter();
  const supabase = createClient();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (error) {
        setStatus(error.message);
        setBusy(false);
        return;
      }
      const totp = data?.totp?.[0];
      if (!totp) {
        router.replace("/dashboard");
        return;
      }
      setFactorId(totp.id);
      setBusy(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;

    setBusy(true);
    setStatus(null);

    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setStatus(challenge.error.message);
      setBusy(false);
      return;
    }

    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    if (verify.error) {
      setStatus(verify.error.message);
      setBusy(false);
      return;
    }

    router.refresh();
    router.replace("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="challengeCode"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          6-digit code
        </label>
        <input
          id="challengeCode"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-lg tracking-[0.4em] text-zinc-900 outline-none transition focus:border-zinc-500"
          placeholder="••••••"
        />
      </div>
      <button
        type="submit"
        disabled={busy || code.length !== 6 || !factorId}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Verifying…" : "Verify"}
      </button>
      {status ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {status}
        </p>
      ) : null}
    </form>
  );
}
