"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Circular Viewer as its own chunk, so the Genome View's other tabs do
 * not ship visx's shapes or this viewer. The member page is a Server
 * Component, and `next/dynamic` called from one does not code-split a Client
 * Component, so the dynamic import lives here (as in `lazy-genome-browser-panel.tsx`).
 */
export const LazyCircularViewerPanel = dynamic(
  () => import("./circular-viewer-panel").then((module) => module.CircularViewerPanel),
  { loading: () => <Skeleton className="m-3 h-96" /> },
);
