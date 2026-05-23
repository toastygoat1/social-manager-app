"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import { Instagram } from "./icons";

const POPUP_W = 520;
const POPUP_H = 700;
const POPUP_CLOSE_GRACE_MS = 1500;
const INSTAGRAM_COMPLETE = "instagram:oauth:complete";
const INSTAGRAM_COMPLETE_MAX_AGE_MS = 60_000;

type ConnectStep = "requirements" | "authorizing" | "connected" | "failed";

type InstagramOAuthUrlResponse = {
  url: string;
};

type InstagramAccountsResponse = {
  isActive?: boolean;
}[];

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

function getConnectedMessage(count: number) {
  return count > 0
    ? `${count} Instagram account${count === 1 ? "" : "s"} connected`
    : "Instagram account connected";
}

async function getInstagramAccountCount() {
  const accounts =
    await apiFetchBrowser<InstagramAccountsResponse>("/instagram/accounts");

  return accounts.filter((account) => account.isActive).length;
}

export function ConnectInstagramButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ConnectStep>("requirements");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  function cleanupPopup() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (popupCloseTimeoutRef.current) {
      clearTimeout(popupCloseTimeoutRef.current);
      popupCloseTimeoutRef.current = null;
    }
    popupRef.current = null;
  }

  useEffect(() => {
    return () => cleanupPopup();
  }, []);

  function openModal() {
    setIsOpen(true);
    setStep("requirements");
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function closeModal() {
    setIsOpen(false);
    if (
      step === "authorizing" &&
      popupRef.current &&
      !popupRef.current.closed
    ) {
      popupRef.current.close();
    }
    cleanupPopup();
  }

  async function startInstagramAuth() {
    setStep("authorizing");
    setErrorMessage(null);
    setSuccessMessage(null);

    const popup = window.open(
      "about:blank",
      "instagramConnect",
      getPopupFeatures(),
    );

    if (!popup) {
      setStep("failed");
      setErrorMessage("Popup blocked. Allow popups and try again.");
      return;
    }

    const openedPopup = popup;
    const origin = window.location.origin;
    let accountCountBeforeAuth: number | null = null;
    let hasHandledCompletion = false;

    function cleanupMessageListener() {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      cleanupPopup();
    }

    function markConnected(count: number) {
      setStep("connected");
      setSuccessMessage(getConnectedMessage(count));
      router.refresh();
    }

    function getMessageCount(count: unknown) {
      if (typeof count === "number" && Number.isFinite(count)) return count;
      if (typeof count === "string") {
        const parsed = Number(count);
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    }

    function handleOAuthCompletion(data: InstagramOAuthMessage) {
      if (hasHandledCompletion) return;
      hasHandledCompletion = true;
      cleanupMessageListener();
      openedPopup.close();

      if (data.status === "error") {
        setStep("failed");
        setErrorMessage(
          typeof data.message === "string"
            ? data.message
            : "Instagram connection failed.",
        );
        return;
      }

      markConnected(getMessageCount(data.count));
    }

    async function handleClosedPopup() {
      cleanupMessageListener();

      if (accountCountBeforeAuth !== null) {
        try {
          const accountCountAfterAuth = await getInstagramAccountCount();
          const connectedCount = accountCountAfterAuth - accountCountBeforeAuth;

          if (connectedCount > 0) {
            markConnected(connectedCount);
            return;
          }
        } catch {
          // Fall through to the cancelled state if the confirmation request fails.
        }
      }

      setStep("failed");
      setErrorMessage("Instagram connection was cancelled.");
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;

      const data = event.data as InstagramOAuthMessage;
      if (data.type !== INSTAGRAM_COMPLETE) return;

      handleOAuthCompletion(data);
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== INSTAGRAM_COMPLETE || !event.newValue) return;

      try {
        const data = JSON.parse(event.newValue) as InstagramOAuthMessage & {
          createdAt?: unknown;
        };
        if (data.type !== INSTAGRAM_COMPLETE) return;
        if (
          typeof data.createdAt === "number" &&
          Date.now() - data.createdAt > INSTAGRAM_COMPLETE_MAX_AGE_MS
        ) {
          return;
        }

        window.localStorage.removeItem(INSTAGRAM_COMPLETE);
        handleOAuthCompletion(data);
      } catch {
        // Ignore malformed storage messages from older tabs.
      }
    }

    function readReturnedPopup() {
      try {
        const popupUrl = new URL(openedPopup.location.href);
        if (popupUrl.origin !== origin || popupUrl.pathname !== "/dashboard") {
          return false;
        }

        const status = popupUrl.searchParams.get("instagram");
        if (status !== "connected" && status !== "error") {
          return false;
        }

        handleOAuthCompletion({
          type: INSTAGRAM_COMPLETE,
          status,
          message: popupUrl.searchParams.get("message") ?? undefined,
          count: popupUrl.searchParams.get("count") ?? undefined,
        });
        return true;
      } catch {
        return false;
      }
    }

    window.localStorage.removeItem(INSTAGRAM_COMPLETE);
    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    popupRef.current = openedPopup;

    try {
      accountCountBeforeAuth = await getInstagramAccountCount().catch(
        () => null,
      );

      const { url } = await apiFetchBrowser<InstagramOAuthUrlResponse>(
        "/instagram/oauth/url",
      );
      openedPopup.location.href = url;
      openedPopup.focus?.();

      pollRef.current = setInterval(() => {
        if (readReturnedPopup()) return;

        if (openedPopup.closed) {
          if (popupCloseTimeoutRef.current) return;

          popupCloseTimeoutRef.current = setTimeout(() => {
            popupCloseTimeoutRef.current = null;
            void handleClosedPopup();
          }, POPUP_CLOSE_GRACE_MS);
        }
      }, 500);
    } catch (error) {
      cleanupMessageListener();
      openedPopup.close();
      setStep("failed");
      setErrorMessage(
        getErrorMessage(error) ?? "Instagram connection is not ready yet.",
      );
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={openModal}
        title="Add Instagram account"
        className="inline-flex h-7 items-center gap-1 rounded-lg bg-cta px-3 text-sm font-medium leading-none text-paper transition hover:bg-cta-edge"
      >
        <Plus className="size-3.5" strokeWidth={2} />
        <span>Add</span>
      </button>

      {successMessage ? (
        <p className="max-w-36 text-right text-[10px] leading-3 text-success">
          {successMessage}
        </p>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-instagram-title"
            className="w-full max-w-[460px] rounded-lg border border-line bg-paper shadow-xl"
          >
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-ink">
                <Instagram className="size-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="connect-instagram-title"
                  className="text-base font-semibold leading-5 text-ink"
                >
                  Add Instagram Account
                </h3>
                <p className="mt-0.5 text-xs leading-4 text-muted">
                  Connect a professional account to this workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                title="Close"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-card hover:text-ink"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>

            <div className="grid grid-cols-3 border-b border-line text-center text-[11px] font-medium text-muted">
              <StepLabel
                active={step === "requirements"}
                done={step !== "requirements"}
              >
                Check
              </StepLabel>
              <StepLabel
                active={step === "authorizing"}
                done={step === "connected"}
              >
                Authorize
              </StepLabel>
              <StepLabel
                active={step === "connected"}
                done={step === "connected"}
              >
                Finish
              </StepLabel>
            </div>

            <div className="px-5 py-5">
              {step === "requirements" ? (
                <RequirementsStep onContinue={startInstagramAuth} />
              ) : null}

              {step === "authorizing" ? <AuthorizingStep /> : null}

              {step === "connected" ? (
                <ConnectedStep
                  message={successMessage ?? "Instagram account connected"}
                  onDone={closeModal}
                />
              ) : null}

              {step === "failed" ? (
                <FailedStep
                  message={errorMessage ?? "Instagram connection failed."}
                  onRetry={startInstagramAuth}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StepLabel({
  active,
  done,
  children,
}: {
  active: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`border-r border-line px-3 py-2 last:border-r-0 ${
        active || done ? "text-ink" : ""
      }`}
    >
      {children}
    </div>
  );
}

function RequirementsStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {[
          "Use an Instagram Business or Creator account.",
          "Use a Meta account added to this app while it is in development.",
          "Keep the redirect URI set in the Meta app dashboard.",
        ].map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm text-ink">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-success"
              strokeWidth={2}
            />
            <span className="leading-5">{item}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cta px-4 text-sm font-semibold text-paper transition hover:bg-cta-edge"
      >
        <ExternalLink className="size-4" strokeWidth={2} />
        Continue with Instagram
      </button>
    </div>
  );
}

function AuthorizingStep() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <LoaderCircle className="size-8 animate-spin text-cta" strokeWidth={2} />
      <p className="mt-4 text-sm font-medium text-ink">
        Waiting for Instagram authorization
      </p>
      <p className="mt-1 max-w-72 text-xs leading-5 text-muted">
        Finish the secure Instagram screen. This modal will update when it is
        done.
      </p>
    </div>
  );
}

function ConnectedStep({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4 text-center">
      <CheckCircle2 className="mx-auto size-10 text-success" strokeWidth={2} />
      <div>
        <p className="text-sm font-semibold text-ink">{message}</p>
        <p className="mt-1 text-xs leading-5 text-muted">
          The account list has been refreshed.
        </p>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="h-10 w-full rounded-lg bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-line-icon"
      >
        Done
      </button>
    </div>
  );
}

function FailedStep({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-danger">
        <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
        <p className="text-xs leading-5">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="h-10 w-full rounded-lg bg-cta px-4 text-sm font-semibold text-paper transition hover:bg-cta-edge"
      >
        Try again
      </button>
    </div>
  );
}
