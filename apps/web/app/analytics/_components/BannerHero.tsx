import Image from "next/image";

export function BannerHero() {
  return (
    <div className="relative flex w-full flex-col items-center p-3">
      <div className="relative h-[330px] w-full overflow-hidden rounded-3xl">
        <Image
          src="/analytics/banner.png"
          alt="Growth Agency banner"
          fill
          priority
          className="object-cover"
          sizes="(max-width: 1500px) 100vw, 1280px"
        />
      </div>
      <div className="-mt-[94px] flex flex-col items-center gap-6">
        <div className="size-[189px] overflow-hidden rounded-full ring-4 ring-paper">
          <Image
            src="/analytics/avatar.png"
            alt="Growth Agency avatar"
            width={189}
            height={189}
            className="size-full object-cover"
          />
        </div>
        <h2 className="text-[32px] font-semibold leading-none text-ink">Growth Agency</h2>
      </div>
    </div>
  );
}
