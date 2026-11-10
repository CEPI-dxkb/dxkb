"use client";

import Image from "next/image";
import { useState } from "react";

// CEPI images sometimes 404, so fall back to the logo.
const fallbackSrc = "/images/websites/cepi.png";

export const NewsCardImage = ({ src, alt }: { src: string; alt: string }) => {
  const [hasError, setHasError] = useState(false);
  // Reset the error flag during render when `src` changes.
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setHasError(false);
  }

  const imageSrc = hasError || !src ? fallbackSrc : src;

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      sizes="(min-width: 768px) 33vw, 100vw"
      className="object-cover"
      onError={() => {
        setHasError(true);
      }}
    />
  );
};
