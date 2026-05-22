import Image from "next/image";
import { Instagram } from "./icons";

type AccountChipProps = {
  name: string;
  platform: string;
  avatarUrl?: string | null;
  className?: string;
};

export function AccountChip({ name, platform, avatarUrl, className }: AccountChipProps) {
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
      <div className="flex flex-col items-start">
        <p className="text-xs leading-none text-ink">{name}</p>
        <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted">
          <Instagram className="size-2.5" strokeWidth={1.8} />
          <span className="leading-4">{platform}</span>
        </div>
      </div>
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
