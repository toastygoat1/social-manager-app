import Image from "next/image";
import totalAccBg from "@/assets/img/img_total_acc.png";

type TotalAccountsCardProps = {
  total: number | null;
};

export function TotalAccountsCard({ total }: TotalAccountsCardProps) {
  return (
    <div className="relative flex h-[169px] w-72 shrink-0 flex-col items-start gap-4 overflow-hidden rounded-2xl border border-cta-edge bg-cta p-6 text-paper">
      <Image
        src={totalAccBg}
        alt=""
        fill
        sizes="288px"
        placeholder="blur"
        className="pointer-events-none object-cover opacity-50"
      />
      <h3 className="relative z-10 text-2xl font-medium leading-none">Total Accounts</h3>
      <p className="relative z-10 text-[64px] font-medium leading-none">
        {total ?? "—"}
      </p>
    </div>
  );
}
