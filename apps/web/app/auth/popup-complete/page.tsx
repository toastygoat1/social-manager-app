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
    <main className="analytics-theme flex min-h-screen items-center justify-center bg-page px-4 text-muted">
      <p className="text-sm">Completing sign-in…</p>
    </main>
  );
}
