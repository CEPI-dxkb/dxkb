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

/**
 * Shared hook that initialises a Mol* plugin inside the given container,
 * loads a PDB file, and keeps the WebGL canvas in sync with resize events.
 *
 * Both the dedicated viewer page and the embedded preview component use this
 * hook — the only difference is the `layout` spec (full panels vs. hidden).
 */
export function useMolstarPlugin(
  filePath: string,
  layout: MolstarLayoutSpec,
): UseMolstarPluginResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<{ dispose: (opts?: object) => void } | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);

  // --- Mol* init & teardown ---
  useEffect(() => {
    if (!filePath) return;

    let disposed = false;

    async function init() {
      if (!containerRef.current) return;

      try {
        const [{ createPluginUI }, { renderReact18 }, { DefaultPluginUISpec }] =
          await Promise.all([
            import("molstar/lib/mol-plugin-ui"),
            import("molstar/lib/mol-plugin-ui/react18"),
            import("molstar/lib/mol-plugin-ui/spec"),
          ]);

        await import("molstar/lib/mol-plugin-ui/skin/light.scss");

        if (disposed) return;
        setStatus("initializing");

        const spec = {
          ...DefaultPluginUISpec(),
          layout: {
            initial: {
              isExpanded: false,
              showControls: layout.showControls,
              controlsDisplay: "reactive" as const,
              regionState: {
                left: layout.regionState,
                top: layout.regionState,
                right: layout.regionState,
                bottom: layout.regionState,
              },
            },
          },
          components: {
            remoteState: "none" as const,
          },
        };

        const plugin = await createPluginUI({
          target: containerRef.current,
          render: renderReact18,
          spec,
        });

        if (disposed) {
          plugin.dispose();
          return;
        }

        pluginRef.current = plugin;

        const url = getProxyUrl(filePath);
        const data = await plugin.builders.data.download(
          { url, isBinary: false },
          { state: { isGhost: true } },
        );
        const trajectory = await plugin.builders.structure.parseTrajectory(
          data,
          "pdb",
        );
        await plugin.builders.structure.hierarchy.applyPreset(
          trajectory,
          "default",
        );

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
      pluginRef.current?.dispose();
      pluginRef.current = null;
    };
  }, [filePath, layout.showControls, layout.regionState, retryCount]);

  // --- Resize sync ---
  // ResizeObserver records that a resize happened; a single rAF applies it
  // so resize + Mol* render are atomic. No perpetual loop — we only schedule
  // a frame when the observer fires.
  const isReady = status === "ready";
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isReady) return;

    let rafId = 0;

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pluginRef.current as any)?.canvas3d?.handleResize();
      });
    });

    try {
      // device-pixel-content-box gives exact device-pixel dimensions,
      // avoiding rounding errors from clientWidth * devicePixelRatio.
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
