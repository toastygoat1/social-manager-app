"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function ConnectGoogleButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError("Not signed in");
          return;
        }
        const res = await fetch(`${API_BASE_URL}/integrations/google/auth`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          setError(`Failed: ${res.status}`);
          return;
        }
        const { authUrl } = (await res.json()) as { authUrl: string };
        window.location.href = authUrl;
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-2 px-4 py-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg bg-cta px-4 py-1.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Loading…" : "Connect Google Calendar"}
      </button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
