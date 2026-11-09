"use client";

import type { ReactNode } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ZoomPanFrameProps {
  /** What zooms and pans. */
  children: ReactNode;
  /** Extra toolbar content rendered before the zoom controls. */
  toolbarLeading?: ReactNode;
}

export function ZoomPanFrame({ children, toolbarLeading }: ZoomPanFrameProps) {
  return (
    <TransformWrapper>
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          <div className="flex items-center gap-1 border-b border-border px-2 py-1">
            {toolbarLeading}
            <div className={toolbarLeading ? "ml-auto flex items-center gap-1" : "flex items-center gap-1"}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  void zoomIn();
                }}
                title="Zoom in"
              >
                <ZoomIn />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  void zoomOut();
                }}
                title="Zoom out"
              >
                <ZoomOut />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  void resetTransform();
                }}
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
              {children}
            </TransformComponent>
          </div>
        </>
      )}
    </TransformWrapper>
  );
}
