"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const POPUP_W = 500;
const POPUP_H = 600;
const OAUTH_COMPLETE = "supabase:oauth:complete";

type Props = {
  provider: Provider;
  label: string;
  loadingLabel?: string;
  icon: ReactNode;
  windowName?: string;
  queryParams?: Record<string, string>;
};

export function OAuthSignInButton({
  provider,
  label,
  loadingLabel,
  icon,
  windowName,
  queryParams,
}: Props) {
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
      windowName ?? `${provider}Auth`,
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
      provider,
      options: {
        redirectTo: `${origin}/auth/callback?next=/auth/popup-complete`,
        skipBrowserRedirect: true,
        queryParams,
      },
    });

    if (oauthError || !data?.url) {
      popup.close();
      setLoading(false);
      setError(oauthError?.message ?? `${provider} sign-in failed.`);
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
        {icon}
        {loading ? (loadingLabel ?? `Opening ${provider}…`) : label}
      </button>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
