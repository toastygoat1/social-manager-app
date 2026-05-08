"use client";

import { useEffect } from "react";

const OAUTH_COMPLETE = "supabase:oauth:complete";

export default function PopupCompletePage() {
  useEffect(() => {
    const opener = window.opener as Window | null;

    if (opener && !opener.closed) {
      try {
        opener.postMessage(
          { type: OAUTH_COMPLETE },
          window.location.origin,
        );
      } catch {
        // ignore
      }
      window.close();
      return;
    }

    window.location.replace("/dashboard");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <p className="text-sm text-zinc-600">Completing sign-in…</p>
    </main>
  );
}
