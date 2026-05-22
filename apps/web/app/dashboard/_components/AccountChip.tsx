"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
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

function getRemoveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Please sign in again before removing this account.";
    }

    if (error.status === 404) {
      return "This Instagram account is already removed or no longer available.";
    }

    return (
      getApiErrorMessage(error) ??
      `Instagram account could not be removed. API returned ${error.status}.`
    );
  }

  return "Instagram account could not be removed. Please try again after the API finishes redeploying.";
}

export function AccountChip({
  accountId,
  name,
  platform,
  avatarUrl,
  className,
}: AccountChipProps) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState(false);

  async function removeAccount() {
    if (!accountId) return;

    const confirmed = window.confirm(`Remove ${name} from this workspace?`);
    if (!confirmed) return;

    setIsRemoving(true);

    try {
      await apiFetchBrowser(
        `/instagram/accounts/${encodeURIComponent(accountId)}`,
        {
          method: "DELETE",
        },
      );
      router.refresh();
    } catch (error) {
      setIsRemoving(false);
      window.alert(getRemoveErrorMessage(error));
    }
  }

  return (
    <div
      className={`flex h-11 items-center gap-2 overflow-hidden rounded-lg bg-paper px-4 py-2 ${className ?? ""}`}
    >
      <div className="relative size-7 shrink-0 overflow-hidden rounded-full bg-line">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            className="size-7 object-cover"
          />
        ) : (
          <div className="flex size-7 items-center justify-center text-[10px] font-medium text-muted">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
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
          onClick={removeAccount}
          disabled={isRemoving}
          title="Remove account"
          aria-label={`Remove ${name}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-danger disabled:pointer-events-none disabled:opacity-60"
        >
          {isRemoving ? (
            <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Trash2 className="size-3.5" strokeWidth={2} />
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
