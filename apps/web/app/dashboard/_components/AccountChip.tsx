"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Link2Off, LoaderCircle } from "lucide-react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import { Instagram } from "./icons";

type AccountChipProps = {
  accountId?: string;
  name: string;
  platform: string;
  avatarUrl?: string | null;
  className?: string;
};

function getApiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const body = error.body as { message?: string | string[] } | null;
  const message = body?.message;

  return Array.isArray(message) ? message[0] : message;
}

function getDisconnectErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Please sign in again before disconnecting this account.";
    }

    if (error.status === 404) {
      return "This Instagram account is already disconnected or no longer available.";
    }

    return (
      getApiErrorMessage(error) ??
      `Instagram account could not be disconnected. API returned ${error.status}.`
    );
  }

  return "Instagram account could not be disconnected. Please try again after the API finishes redeploying.";
}

function getFallbackInitial(name: string) {
  return name.replace(/^@/, "").trim().charAt(0).toUpperCase() || "I";
}

export function AccountChip({
  accountId,
  name,
  platform,
  avatarUrl,
  className,
}: AccountChipProps) {
  const router = useRouter();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  async function disconnectAccount() {
    if (!accountId) return;

    const confirmed = window.confirm(`Disconnect ${name} from this workspace?`);
    if (!confirmed) return;

    setIsDisconnecting(true);

    try {
      await apiFetchBrowser(
        `/instagram/accounts/${encodeURIComponent(accountId)}`,
        {
          method: "DELETE",
        },
      );
      router.refresh();
    } catch (error) {
      setIsDisconnecting(false);
      window.alert(getDisconnectErrorMessage(error));
    }
  }

  return (
    <div
      className={`flex h-11 items-center gap-2 overflow-hidden rounded-lg bg-paper px-4 py-2 ${className ?? ""}`}
    >
      <div className="relative size-7 shrink-0 overflow-hidden rounded-full bg-line">
        <div className="flex size-7 items-center justify-center text-[10px] font-medium text-muted">
          <AvatarImage
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            className="size-7 object-cover"
            fallback={getFallbackInitial(name)}
            fallbackSeed={accountId ?? name}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <p className="truncate text-xs leading-none text-ink">{name}</p>
        <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted">
          <Instagram className="size-2.5" strokeWidth={1.8} />
          <span className="truncate leading-4">{platform}</span>
        </div>
      </div>
      {accountId ? (
        <button
          type="button"
          onClick={disconnectAccount}
          disabled={isDisconnecting}
          title="Disconnect account"
          aria-label={`Disconnect ${name}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-danger disabled:pointer-events-none disabled:opacity-60"
        >
          {isDisconnecting ? (
            <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Link2Off className="size-3.5" strokeWidth={2} />
          )}
        </button>
      ) : null}
    </div>
  );
}

export function AllAccountsChip({ className }: { className?: string }) {
  return (
    <div
      className={`flex h-11 items-center gap-2 rounded-lg bg-paper px-4 py-2 ${className ?? ""}`}
    >
      <div className="grid size-7 shrink-0 grid-cols-2 grid-rows-2 gap-1 rounded-lg bg-ink p-1.5">
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
      </div>
      <p className="text-sm text-ink">All Accounts</p>
    </div>
  );
}
