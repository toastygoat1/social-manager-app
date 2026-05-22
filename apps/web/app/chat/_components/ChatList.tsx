import { CircleCheck } from "lucide-react";
import { AllAccountsChip } from "@/app/dashboard/_components/AccountChip";
import { CHATS } from "./data";

export function ChatList() {
  return (
    <div className="flex h-full w-[347px] shrink-0 flex-col gap-3 border-x border-line">
      <div className="flex w-full flex-col items-start border-b border-line p-3">
        <AllAccountsChip className="border border-line" />
      </div>

      <div className="flex flex-col gap-2 px-2">
        <div className="flex items-center px-4">
          <h2 className="text-[20px] font-medium text-ink">Chats</h2>
        </div>

        <div className="flex flex-col items-center justify-center gap-1">
          {CHATS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="relative flex h-[68px] w-[331px] items-center gap-3 rounded-lg px-3 text-left hover:bg-bg"
            >
              <div
                className="flex size-[54px] shrink-0 items-center justify-center rounded-full text-[20px] font-medium text-white"
                style={{ backgroundColor: c.bg }}
                aria-hidden
              >
                {c.initial}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-[17px] font-medium leading-[22px] tracking-[-0.4px] text-ink">
                  {c.name}
                </p>
                <p className="truncate text-[14px] leading-5 tracking-[-0.15px] text-muted">
                  {c.snippet} · {c.time}
                </p>
              </div>
              {c.read ? (
                <CircleCheck
                  className="size-[14px] shrink-0 text-muted"
                  strokeWidth={1.6}
                />
              ) : (
                <span className="size-[14px] shrink-0 rounded-full border border-muted" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
