"use client";

import { useEffect, useRef, useState } from "react";
// The site's overrides of Mol*'s skin load with the viewer, not in globals.css
// on every route. Imported before the skin so the skin still comes after them
// (as it did when they sat in globals.css), so a tie of equal specificity
// resolves as it used to.
import "@/styles/molstar-theme.css";
import "molstar/lib/mol-plugin-ui/skin/light.scss";

import type { StructureSource } from "@/lib/protein-structure-view/source";
import { noop } from "@/lib/utils";
import { loadMolstar } from "./molstar-loader";
import { downloadStructure } from "./structure-download";

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
 * dispose() can throw on a partially initialised plugin; swallow it so it never masks
 * the original error.
 */
function disposePlugin(plugin: MolstarPluginHandle | null): void {
  if (!plugin) return;
  try {
    plugin.dispose();
  } catch (disposeError) {
    console.error("Failed to dispose Mol* plugin", disposeError);
  }
}

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
    // isDisposed is a function call so TypeScript cannot narrow it to false after a guard;
    // cleanup can set it at any await boundary.
    const lifecycle = { disposed: false };
    const isDisposed = (): boolean => lifecycle.disposed;
    const downloadController = new AbortController();

    async function init() {
      setStatus("loading");
      setErrorMessage(undefined);

      if (!source.url || !containerRef.current) return;

      // The no-op catch only keeps the download from being reported as unhandled while
      // Mol* loads; its failure is handled where awaited below.
      const download = downloadStructure(
        {
          url: source.url,
          format: source.format,
          label: source.label,
          kind: source.kind,
        },
        downloadController.signal,
      );
      download.catch(noop);

      // Computed outside the try: a ternary inside it makes the React Compiler skip this
      // hook.
      const format = source.format === "bcif" ? "mmcif" : source.format;

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

        const contents = await download;
        if (isDisposed()) return;
        const data = await plugin.builders.data.rawData(
          { data: contents, label: source.label },
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
        // Dispose immediately so the scarce WebGL context is released while the error
        // shows; clearing the ref makes the final cleanup a no-op for this instance.
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
      // Set disposed before disposing so a concurrent init() continuation skips its own
      // dispose.
      lifecycle.disposed = true;
      downloadController.abort();
      disposePlugin(pluginRef.current);
      pluginRef.current = null;
    };
  }, [
    source.url,
    source.format,
    source.label,
    source.kind,
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
      // device-pixel-content-box gives exact device-pixel dimensions, avoiding rounding
      // from clientWidth * devicePixelRatio.
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
