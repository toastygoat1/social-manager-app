"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import { Instagram } from "./icons";

type AccountChipProps = {
  accountId?: string;
  name: string;
  platform: string;
  avatarUrl?: string | null;
  className?: string;
};

type BackfillResponse = {
  scanned: number;
  imported: number;
  updated: number;
  analyticsCreated: number;
  analyticsSkipped: number;
  failed: number;
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

function getBackfillErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Please sign in again before importing Instagram posts.";
    }

    if (error.status === 404) {
      return "This Instagram account is no longer connected.";
    }

    return (
      getApiErrorMessage(error) ??
      `Instagram posts could not be imported. API returned ${error.status}.`
    );
  }

  return "Instagram posts could not be imported. Please try again after the API finishes redeploying.";
}

function getBackfillSuccessMessage(result: BackfillResponse) {
  const parts = [
    `${result.imported} imported`,
    `${result.updated} updated`,
    `${result.analyticsCreated} analytics snapshots`,
  ];

  if (result.failed > 0) {
    parts.push(`${result.failed} failed`);
  }

  return `Backfill complete: ${parts.join(", ")}.`;
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
  const [isRemoving, setIsRemoving] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);

  async function backfillPosts() {
    if (!accountId) return;

    const confirmed = window.confirm(
      `Import recent Instagram posts for ${name}? This will fetch up to 250 existing posts and current metrics.`,
    );
    if (!confirmed) return;

    setIsBackfilling(true);

    try {
      const result = await apiFetchBrowser<BackfillResponse>(
        `/instagram/accounts/${encodeURIComponent(accountId)}/backfill`,
        {
          method: "POST",
          body: { limit: 250 },
        },
      );
      window.alert(getBackfillSuccessMessage(result));
      router.refresh();
    } catch (error) {
      window.alert(getBackfillErrorMessage(error));
    } finally {
      setIsBackfilling(false);
    }
  }

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
            {getFallbackInitial(name)}
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
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={backfillPosts}
            disabled={isBackfilling || isRemoving}
            title="Import recent Instagram posts"
            aria-label={`Import recent Instagram posts for ${name}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-emerald-50 hover:text-success disabled:pointer-events-none disabled:opacity-60"
          >
            {isBackfilling ? (
              <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <RefreshCw className="size-3.5" strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            onClick={removeAccount}
            disabled={isRemoving || isBackfilling}
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
        </div>
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
