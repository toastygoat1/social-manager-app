"use client";

import { useState, useTransition } from "react";
import { approveConnector, denyConnector } from "./actions";

type ConsentFormProps = {
  requestId: string;
  userEmail: string;
};

export function ConsentForm({ requestId, userEmail }: ConsentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"approve" | "deny" | null>(null);

  const run = (kind: "approve" | "deny") => {
    setError(null);
    setAction(kind);
    startTransition(async () => {
      const result =
        kind === "approve"
          ? await approveConnector(requestId)
          : await denyConnector(requestId);
      if ("error" in result) {
        setError(result.error);
        setAction(null);
        return;
      }
      window.location.href = result.redirectTo;
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-line bg-card p-4 text-sm text-ink">
        <p className="font-medium text-ink">Claude wants to connect</p>
        <p className="mt-1">
          It will be able to <strong>view your workspace folders</strong> and{" "}
          <strong>create and update tasks</strong> on your behalf.
        </p>
        <p className="mt-2 text-muted">
          Signed in as <span className="font-medium">{userEmail}</span>
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-[color-mix(in_srgb,var(--danger)_12%,var(--bg-light))] px-3 py-2 text-sm text-ink">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => run("approve")}
          disabled={isPending}
          className="flex-1 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-60"
        >
          {isPending && action === "approve" ? "Authorizing…" : "Allow"}
        </button>
        <button
          type="button"
          onClick={() => run("deny")}
          disabled={isPending}
          className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-card disabled:opacity-60"
        >
          {isPending && action === "deny" ? "Cancelling…" : "Deny"}
        </button>
      </div>
    </div>
  );
}
