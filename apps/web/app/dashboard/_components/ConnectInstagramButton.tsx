"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";

const POPUP_W = 520;
const POPUP_H = 700;
const INSTAGRAM_COMPLETE = "instagram:oauth:complete";

type InstagramOAuthUrlResponse = {
  url: string;
};

type InstagramOAuthMessage = {
  type?: unknown;
  status?: unknown;
  message?: unknown;
  count?: unknown;
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string | string[] } | null;
    const message = body?.message;
    return Array.isArray(message) ? message[0] : message;
  }

  return error instanceof Error ? error.message : null;
}

function getPopupFeatures() {
  const left = window.screenX + Math.max(0, (window.outerWidth - POPUP_W) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - POPUP_H) / 2);

  return `popup=yes,width=${POPUP_W},height=${POPUP_H},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
}

export function ConnectInstagramButton() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleConnect() {
    setIsConnecting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const popup = window.open(
      "about:blank",
      "instagramConnect",
      getPopupFeatures(),
    );

    if (!popup) {
      setIsConnecting(false);
      setErrorMessage("Popup blocked. Allow popups and try again.");
      return;
    }

    const openedPopup = popup;
    const origin = window.location.origin;

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

      const data = event.data as InstagramOAuthMessage;
      if (data.type !== INSTAGRAM_COMPLETE) return;

      cleanup();
      openedPopup.close();
      setIsConnecting(false);

      if (data.status === "error") {
        setErrorMessage(
          typeof data.message === "string"
            ? data.message
            : "Instagram connection failed.",
        );
        return;
      }

      const count = typeof data.count === "number" ? data.count : 0;
      setSuccessMessage(
        count > 0
          ? `${count} Instagram account${count === 1 ? "" : "s"} connected`
          : "Instagram account connected",
      );
      router.refresh();
    }

    window.addEventListener("message", onMessage);
    popupRef.current = openedPopup;

    try {
      const { url } = await apiFetchBrowser<InstagramOAuthUrlResponse>(
        "/instagram/oauth/url",
      );
      openedPopup.location.href = url;
      openedPopup.focus?.();

      pollRef.current = setInterval(() => {
        if (openedPopup.closed) {
          cleanup();
          setIsConnecting(false);
        }
      }, 500);
    } catch (error) {
      cleanup();
      openedPopup.close();
      setIsConnecting(false);
      setErrorMessage(
        getErrorMessage(error) ?? "Instagram connection is not ready yet.",
      );
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleConnect}
        disabled={isConnecting}
        title="Add Instagram account"
        className="inline-flex h-7 items-center gap-1 rounded-lg bg-cta px-3 text-sm font-medium leading-none text-paper transition hover:bg-cta-edge disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Plus className="size-3.5" strokeWidth={2} />
        <span>{isConnecting ? "Opening" : "Add"}</span>
      </button>
      {errorMessage ? (
        <p className="max-w-36 text-right text-[10px] leading-3 text-danger">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="max-w-36 text-right text-[10px] leading-3 text-success">
          {successMessage}
        </p>
      ) : null}
    </div>
  );
}
