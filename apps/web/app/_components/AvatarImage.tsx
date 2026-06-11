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

const FALLBACK_COLORS = [
  "#b2a4ed",
  "#73b1f4",
  "#66d4ef",
  "#61ddbb",
  "#f0b86e",
  "#ee8fa7",
  "#9bb2ff",
  "#85d2a8",
];

function getFallbackColor(seed: string) {
  const cleanSeed = seed.trim() || "?";
  let hash = 0;
  for (let index = 0; index < cleanSeed.length; index += 1) {
    hash = (hash * 31 + cleanSeed.charCodeAt(index)) % FALLBACK_COLORS.length;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export function AvatarImage({
  src,
  alt,
  width,
  height,
  className,
  fallback,
}: AvatarImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fallbackLabel = (fallback || "?").trim().slice(0, 2).toUpperCase();
  const fallbackColor = getFallbackColor(fallbackLabel);

  if (!src || failedSrc === src) {
    return (
      <span
        aria-hidden={alt ? undefined : true}
        className={`relative inline-flex items-center justify-center overflow-hidden font-semibold uppercase leading-none text-white ${className ?? ""}`}
        style={{
          width,
          height,
          backgroundColor: fallbackColor,
          fontSize: Math.max(Math.round(width * 0.42), 9),
        }}
      >
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
