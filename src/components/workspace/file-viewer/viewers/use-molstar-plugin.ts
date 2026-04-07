"use client";

import { useEffect, useRef, useState } from "react";
import { getProxyUrl } from "../file-viewer-registry";

export type ViewerStatus = "loading" | "initializing" | "ready" | "error";

export interface MolstarLayoutSpec {
  showControls: boolean;
  regionState: "full" | "hidden";
}

export interface UseMolstarPluginResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  status: ViewerStatus;
  errorMessage: string | undefined;
  resetError: () => void;
}

/** Resolved type of the global `molstar.Viewer` created by the pre-built bundle. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MolstarViewer = any;

/**
 * Inject a `<link>` for molstar.css (once).
 */
function ensureMolstarCss(): void {
  if (document.querySelector('link[href="/molstar/molstar.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/molstar/molstar.css";
  document.head.appendChild(link);
}

/**
 * Inject a `<script>` for molstar.js and resolve once the global is available.
 */
function loadMolstarBundle(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).molstar) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="/molstar/molstar.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = "/molstar/molstar.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Molstar bundle"));
    document.head.appendChild(script);
  });
}

/**
 * Shared hook that loads the pre-built Mol* viewer bundle, creates a viewer
 * inside the given container, and loads a PDB file.
 *
 * Uses the pre-built `molstar.js` bundle (from `public/molstar/`) which
 * bypasses Turbopack's module bundling entirely, avoiding a production-only
 * bug where Turbopack creates self-referential namespace bindings for
 * `import * as X; export { X }` barrel modules.
 */
export function useMolstarPlugin(
  filePath: string,
  layout: MolstarLayoutSpec,
): UseMolstarPluginResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<MolstarViewer | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!filePath) return;

    let disposed = false;

    async function init() {
      if (!containerRef.current) return;

      try {
        ensureMolstarCss();
        await loadMolstarBundle();

        if (disposed) return;
        setStatus("initializing");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const molstar = (window as any).molstar;

        const isFull = layout.regionState === "full";
        const viewer: MolstarViewer = await molstar.Viewer.create(
          containerRef.current,
          {
            layoutIsExpanded: false,
            layoutShowControls: layout.showControls,
            layoutControlsDisplay: "reactive",
            layoutShowSequence: isFull,
            layoutShowLog: isFull,
            layoutShowLeftPanel: isFull,
            collapseRightPanel: !isFull,
            layoutShowRemoteState: false,
          },
        );

        if (disposed) {
          viewer.dispose();
          return;
        }

        viewerRef.current = viewer;

        const url = getProxyUrl(filePath);
        await viewer.loadAllModelsOrAssemblyFromUrl(url, "pdb", false);

        if (disposed) return;
        setStatus("ready");
      } catch (err) {
        if (disposed) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to load structure",
        );
        setStatus("error");
      }
    }

    init();

    return () => {
      disposed = true;
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [filePath, layout.showControls, layout.regionState, retryCount]);

  // --- Resize sync ---
  const isReady = status === "ready";
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isReady) return;

    let rafId = 0;

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        viewerRef.current?.plugin?.canvas3d?.handleResize();
      });
    });

    try {
      observer.observe(container, {
        box: "device-pixel-content-box" as ResizeObserverBoxOptions,
      });
    } catch {
      observer.observe(container);
    }

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [isReady]);

  const resetError = () => {
    setStatus("loading");
    setErrorMessage(undefined);
    setRetryCount((c) => c + 1);
  };

  return { containerRef, status, errorMessage, resetError };
}
