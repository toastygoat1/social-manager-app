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
  const fallbackLabel = fallback || "I";

  if (!src || failedSrc === src) {
    return <>{fallbackLabel}</>;
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
