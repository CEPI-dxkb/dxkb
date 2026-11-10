"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * `next/dynamic` called from a Server Component does not code-split a Client
 * Component, so the dynamic import lives here.
 */
export const LazyCircularViewerPanel = dynamic(
  () => import("./circular-viewer-panel").then((module) => module.CircularViewerPanel),
  { loading: () => <Skeleton className="m-3 h-96" /> },
);
