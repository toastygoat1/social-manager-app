"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const POPUP_W = 500;
const POPUP_H = 600;
const OAUTH_COMPLETE = "supabase:oauth:complete";

export function GoogleSignInButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleClick() {
    setError(null);
    setLoading(true);

    const left = window.screenX + Math.max(0, (window.outerWidth - POPUP_W) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - POPUP_H) / 2);
    const popup = window.open(
      "about:blank",
      "googleAuth",
      `popup=yes,width=${POPUP_W},height=${POPUP_H},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`,
    );

    if (!popup) {
      setLoading(false);
      setError("Popup blocked. Allow popups and try again.");
      return;
    }

    const supabase = createClient();
    const origin = window.location.origin;

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/auth/popup-complete`,
        skipBrowserRedirect: true,
        scopes:
          "openid email profile https://www.googleapis.com/auth/calendar.readonly",
        queryParams: {
          prompt: "select_account consent",
          access_type: "offline",
        },
      },
    });

    if (oauthError || !data?.url) {
      popup.close();
      setLoading(false);
      setError(oauthError?.message ?? "Google sign-in failed.");
      return;
    }

    popup.location.href = data.url;
    popupRef.current = popup;
    popup.focus?.();

    function cleanup() {
      window.removeEventListener("message", onMessage);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      popupRef.current = null;
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      if (event.data?.type !== OAUTH_COMPLETE) return;

      cleanup();
      popup?.close();

      if (event.data?.error) {
        setLoading(false);
        setError(String(event.data.error));
        return;
      }

      router.refresh();
      router.push("/dashboard");
    }

    window.addEventListener("message", onMessage);

    pollRef.current = setInterval(() => {
      if (popup.closed) {
        cleanup();
        setLoading(false);
      }
    }, 500);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.45c-.24 1.4-1.7 4.1-5.45 4.1-3.28 0-5.96-2.72-5.96-6.05S8.72 6.1 12 6.1c1.87 0 3.12.8 3.83 1.48l2.61-2.5C16.85 3.6 14.62 2.7 12 2.7 6.93 2.7 2.83 6.8 2.83 11.85S6.93 21 12 21c6.93 0 9.16-4.86 9.16-7.4 0-.5-.05-.88-.12-1.4H12z"
          />
        </svg>
        {loading ? "Opening Google…" : "Continue with Google"}
      </button>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
