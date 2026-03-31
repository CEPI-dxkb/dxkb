"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getProxyUrl } from "../file-viewer-registry";
import { ExpandableViewerWrapper } from "./expandable-viewer-wrapper";

type ViewerStatus = "loading" | "initializing" | "ready" | "error";

interface StructureViewerProps {
  filePath: string;
  fileName: string;
}

export function StructureViewer({ filePath, fileName }: StructureViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<{ dispose: (opts?: object) => void } | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    let disposed = false;

    async function init() {
      if (!containerRef.current) return;

      try {
        // Dynamically import Mol* modules — keeps the ~5MB bundle out of the
        // main chunk and avoids SSR issues (WebGL requires a DOM).
        const [{ createPluginUI }, { renderReact18 }, { DefaultPluginUISpec }] =
          await Promise.all([
            import("molstar/lib/mol-plugin-ui"),
            import("molstar/lib/mol-plugin-ui/react18"),
            import("molstar/lib/mol-plugin-ui/spec"),
          ]);

        // Import Mol* skin CSS — processed by sass at build time, tree-shaken
        // by Next.js when the component isn't rendered.
        await import("molstar/lib/mol-plugin-ui/skin/light.scss");

        if (disposed) return;
        setStatus("initializing");

        const spec = {
          ...DefaultPluginUISpec(),
          layout: {
            initial: {
              isExpanded: false,
              showControls: true,
              controlsDisplay: "reactive" as const,
              regionState: {
                left: "hidden" as const,
                top: "full" as const,
                right: "hidden" as const,
                bottom: "hidden" as const,
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

        // Load the PDB file from the authenticated proxy URL.
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
  }, [filePath]);

  // Keep the WebGL canvas in sync with container size changes (panel resize,
  // expand/collapse).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || status !== "ready") return;

    const observer = new ResizeObserver(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pluginRef.current as any)?.canvas3d?.handleResize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [status]);

  return (
    <ExpandableViewerWrapper title={fileName}>
      <div className="relative flex h-full w-full flex-col">
        <div
          ref={containerRef}
          className="isolate relative min-h-0 flex-1"
          data-testid="molstar-container"
        />
        {(status === "loading" || status === "initializing") && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/80 text-muted-foreground">
            <Spinner className="h-5 w-5" />
            <span className="text-sm">
              {status === "loading"
                ? "Loading viewer\u2026"
                : "Initializing structure\u2026"}
            </span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm">{errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatus("loading");
                setErrorMessage(undefined);
              }}
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    </ExpandableViewerWrapper>
  );
}
