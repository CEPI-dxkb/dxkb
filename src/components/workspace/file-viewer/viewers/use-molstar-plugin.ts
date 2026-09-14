"use client";

import { useEffect, useRef, useState } from "react";
import "molstar/lib/mol-plugin-ui/skin/light.scss";

import type { StructureSource } from "@/lib/protein-structure-view/source";
import { loadMolstar } from "./molstar-loader";

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

interface MolstarPluginHandle {
  dispose: (opts?: object) => void;
}

/**
 * Disposes a Mol* plugin instance defensively. `dispose()` can throw on a
 * partially-initialised plugin (e.g. one that failed mid-download); logging
 * and swallowing that failure — rather than letting it propagate — ensures a
 * broken disposal never masks the original error that triggered it.
 */
function disposePlugin(plugin: MolstarPluginHandle | null): void {
  if (!plugin) return;
  try {
    plugin.dispose();
  } catch (disposeError) {
    console.error("Failed to dispose Mol* plugin", disposeError);
  }
}

/**
 * Shared hook that initialises a Mol* plugin inside the given container,
 * loads a resolved structure source, and keeps the WebGL canvas in sync with
 * resize events.
 *
 * Both the dedicated viewer page and the embedded preview component use this
 * hook - the only difference is the `layout` spec (full panels vs. hidden).
 */
export function useMolstarPlugin(
  source: StructureSource,
  layout: MolstarLayoutSpec,
): UseMolstarPluginResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<MolstarPluginHandle | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // `isDisposed` reads through a function call so TypeScript cannot narrow the
    // return value to `false` after a guard — the cleanup callback can set it to
    // `true` at any await boundary and all subsequent checks are genuinely needed.
    const lifecycle = { disposed: false };
    const isDisposed = (): boolean => lifecycle.disposed;

    async function init() {
      setStatus("loading");
      setErrorMessage(undefined);

      if (!source.url || !containerRef.current) return;

      try {
        const { createPluginUI, renderReact18, DefaultPluginUISpec } =
          await loadMolstar();

        if (isDisposed()) return;
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

        if (isDisposed()) {
          disposePlugin(plugin);
          return;
        }

        pluginRef.current = plugin;

        const isBinary = source.format === "bcif";
        const format = source.format === "bcif" ? "mmcif" : source.format;
        const data = await plugin.builders.data.download(
          { url: source.url, isBinary },
          { state: { isGhost: true } },
        );
        const trajectory = await plugin.builders.structure.parseTrajectory(
          data,
          format,
        );
        await plugin.builders.structure.hierarchy.applyPreset(
          trajectory,
          "default",
        );

        if (isDisposed()) return;
        setStatus("ready");
      } catch (err) {
        if (isDisposed()) return;
        // A failure here can follow a successful plugin creation (download /
        // parse / preset failed). Dispose immediately so the scarce WebGL
        // context is released while the error screen is shown rather than
        // held until a retry or unmount. Clearing the ref afterwards makes
        // the final effect cleanup below a no-op for this instance, so the
        // two paths can never double-dispose the same plugin.
        disposePlugin(pluginRef.current);
        pluginRef.current = null;
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to load structure",
        );
        setStatus("error");
      }
    }

    void init();

    return () => {
      // Setting `disposed` before disposing means a concurrent async
      // continuation of `init()` (e.g. a download that rejects after
      // unmount) will see `isDisposed()` as true and skip its own dispose,
      // so the plugin is only ever disposed once.
      lifecycle.disposed = true;
      disposePlugin(pluginRef.current);
      pluginRef.current = null;
    };
  }, [
    source.url,
    source.format,
    layout.showControls,
    layout.regionState,
    retryCount,
  ]);

  const isReady = status === "ready";
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isReady) return;

    let rafId = 0;

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        (
          pluginRef.current as {
            canvas3d?: { handleResize?: () => void };
          } | null
        )?.canvas3d?.handleResize?.();
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
    setErrorMessage(undefined);
    setRetryCount((c) => c + 1);
  };

  return { containerRef, status, errorMessage, resetError };
}
