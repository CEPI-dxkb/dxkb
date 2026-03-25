"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ZoomableImageProps {
  src: string;
  alt: string;
  /** Extra toolbar content rendered before the zoom controls. */
  toolbarLeading?: ReactNode;
}

export function ZoomableImage({ src, alt, toolbarLeading }: ZoomableImageProps) {
  return (
    <div className="flex h-full w-full flex-col">
      <TransformWrapper>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="flex items-center gap-1 border-b border-border px-2 py-1">
              {toolbarLeading}
              <div className={toolbarLeading ? "ml-auto flex items-center gap-1" : "flex items-center gap-1"}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => zoomIn()}
                  title="Zoom in"
                >
                  <ZoomIn />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => zoomOut()}
                  title="Zoom out"
                >
                  <ZoomOut />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => resetTransform()}
                  title="Reset"
                >
                  <RotateCcw />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="!w-full !h-full flex items-center justify-center"
              >
                <Image
                  src={src}
                  alt={alt}
                  width={0}
                  height={0}
                  sizes="100vw"
                  className="h-auto w-auto max-h-full max-w-full object-contain"
                  unoptimized
                />
              </TransformComponent>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
