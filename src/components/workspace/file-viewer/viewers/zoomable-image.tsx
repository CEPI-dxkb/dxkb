"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";

import { Spinner } from "@/components/ui/spinner";

function ZoomLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner />
    </div>
  );
}

// react-zoom-pan-pinch loads with the first image or SVG preview. The image
// (next/image) stays out here: every route already loads it for the logo, and
// putting it behind the boundary made Turbopack re-split the shared chunks so
// that other routes loaded more, not less.
const ZoomPanFrame = dynamic(
  () => import("./zoom-pan-frame").then((module) => module.ZoomPanFrame),
  { ssr: false, loading: ZoomLoading },
);

interface ZoomableImageProps {
  src: string;
  alt: string;
  toolbarLeading?: ReactNode;
}

export function ZoomableImage({ src, alt, toolbarLeading }: ZoomableImageProps) {
  return (
    <div className="flex size-full flex-col">
      <ZoomPanFrame toolbarLeading={toolbarLeading}>
        <Image
          src={src}
          alt={alt}
          width={0}
          height={0}
          sizes="100vw"
          className="size-auto max-h-full max-w-full object-contain"
          unoptimized
        />
      </ZoomPanFrame>
    </div>
  );
}
