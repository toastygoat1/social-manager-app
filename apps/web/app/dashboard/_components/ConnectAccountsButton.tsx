"use client";

import { Plus } from "lucide-react";
import { ConnectInstagramButton } from "./ConnectInstagramButton";

type ConnectAccountsButtonProps = {
  label?: string;
};

export function ConnectAccountsButton({
  label = "Add account",
}: ConnectAccountsButtonProps) {
  return (
    <ConnectInstagramButton
      buttonClassName="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cta px-3 text-xs font-semibold text-white transition hover:bg-cta-edge"
      showSuccessMessage={false}
      title="Add Instagram account"
    >
      <Plus className="size-3.5" strokeWidth={2} />
      <span>{label}</span>
    </ConnectInstagramButton>
  );
}
