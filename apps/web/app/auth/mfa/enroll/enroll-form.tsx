"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EnrollState = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function EnrollForm() {
  const router = useRouter();
  const supabase = createClient();

  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setBusy(true);
      setStatus(null);

      const existing = await supabase.auth.mfa.listFactors();
      if (existing.data?.totp?.length) {
        router.replace(
          `/dashboard?message=${encodeURIComponent("Two-factor already enabled.")}`,
        );
        return;
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `totp-${Date.now()}`,
      });

      if (cancelled) return;

      if (error || !data) {
        setStatus(error?.message ?? "Failed to start enrollment.");
        setBusy(false);
        return;
      }

      setEnroll({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setBusy(false);
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;

    setBusy(true);
    setStatus(null);

    const challenge = await supabase.auth.mfa.challenge({
      factorId: enroll.factorId,
    });
    if (challenge.error) {
      setStatus(challenge.error.message);
      setBusy(false);
      return;
    }

    const verify = await supabase.auth.mfa.verify({
      factorId: enroll.factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    });

    if (verify.error) {
      setStatus(verify.error.message);
      setBusy(false);
      return;
    }

    router.refresh();
    router.replace(
      `/dashboard?message=${encodeURIComponent("Two-factor enabled.")}`,
    );
  }

  if (busy && !enroll) {
    return <p className="mt-6 text-sm text-zinc-500">Preparing…</p>;
  }

  if (!enroll) {
    return (
      <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {status ?? "Failed to start enrollment."}
      </p>
    );
  }

  return (
    <form onSubmit={handleVerify} className="mt-6 space-y-4">
      <div className="flex justify-center">
        {/* qr_code is an inline SVG (data URI). Use <img> to avoid Next image config. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enroll.qrCode}
          alt="TOTP QR code"
          className="h-44 w-44 rounded-md border border-zinc-200 bg-white p-2"
        />
      </div>
      <p className="break-all rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700">
        {enroll.secret}
      </p>
      <div>
        <label
          htmlFor="totpCode"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          6-digit code
        </label>
        <input
          id="totpCode"
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
        disabled={busy || code.length !== 6}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Verifying…" : "Verify & enable"}
      </button>
      {status ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {status}
        </p>
      ) : null}
    </form>
  );
}
