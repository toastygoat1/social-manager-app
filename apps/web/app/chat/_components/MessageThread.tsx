import { UserCircle } from "lucide-react";
import { BUBBLES } from "./data";

export function MessageThread() {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <div className="flex h-[68px] w-full shrink-0 items-center gap-4 border-b border-line px-3 py-2">
        <UserCircle className="size-7 text-ink" strokeWidth={1.4} aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-center text-[16px] font-medium leading-4 text-ink">
            Ambacafe
          </h2>
          <p
            aria-live="polite"
            className="text-center text-[10px] font-medium leading-4 text-[#00d547] opacity-70"
          >
            Ambacafe is typing…
          </p>
        </div>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation with Ambacafe"
        className="flex min-h-0 w-full flex-1 flex-col gap-7 overflow-y-auto p-5"
      >
        {BUBBLES.map((b, i) => {
          if (b.side === "them") {
            return (
              <div key={i} className="flex w-full">
                <div className="relative max-w-[645px] rounded-[18px] rounded-bl-[6px] border border-line bg-paper px-[14px] py-[7px] text-[17px] leading-[22px] text-ink">
                  {b.text}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="flex w-full justify-end">
              <div
                className="relative max-w-[645px] rounded-[18px] rounded-br-[6px] bg-cta px-[14px] py-[7px] text-[17px] leading-[22px] text-white"
                style={b.width ? { width: b.width } : undefined}
              >
                {b.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
