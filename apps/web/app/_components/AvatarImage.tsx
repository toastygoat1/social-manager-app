"use client";

import Image from "next/image";
import { useState } from "react";

type AvatarImageProps = {
  src?: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallback: string;
};

export function AvatarImage({
  src,
  alt,
  width,
  height,
  className,
  fallback,
}: AvatarImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fallbackLabel = (fallback || "?").trim().slice(0, 2);

  if (!src || failedSrc === src) {
    return (
      <span
        aria-hidden={alt ? undefined : true}
        className={`relative inline-flex items-center justify-center overflow-hidden bg-[#e9e9e9] font-semibold uppercase leading-none text-[#5a5a5a] ${className ?? ""}`}
        style={{
          width,
          height,
          fontSize: Math.max(Math.round(width * 0.42), 9),
        }}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="absolute inset-0 size-full opacity-40"
          fill="currentColor"
        >
          <circle cx="12" cy="9" r="3.6" />
          <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6v.5H4.5z" />
        </svg>
        <span className="relative">{fallbackLabel}</span>
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setFailedSrc(src)}
      referrerPolicy="no-referrer"
      unoptimized
    />
  );
}
