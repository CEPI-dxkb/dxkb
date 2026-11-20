"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";

import { supportsWebGl2 } from "@/lib/interactions/webgl-support";
import type { GraphCanvasProps } from "@/lib/interactions/types";

import { WebGl2Notice } from "./webgl2-notice";

// Sigma 4 needs WebGL 2 and throws without it (v3 fell back to WebGL 1), which would blank the
// whole Interactions view. Its modules also read `WebGL2RenderingContext` constants as they load,
// so in a browser without that global the import itself rejects. The probe therefore runs here,
// before the import: without WebGL 2 the Sigma chunk is never fetched and the notice stands in
// for the canvas. `ssr: false` keeps the loader client-side, where the probe can read `document`.
async function loadGraphCanvas(): Promise<ComponentType<GraphCanvasProps>> {
  if (!supportsWebGl2()) return WebGl2Notice;
  const { SigmaCanvas } = await import("./sigma/sigma-canvas");
  return SigmaCanvas;
}

export const GraphCanvas = dynamic<GraphCanvasProps>(loadGraphCanvas, {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
      Loading graph…
    </div>
  ),
});
