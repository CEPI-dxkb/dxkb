"use client";

import { use, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getProxyUrl } from "@/components/workspace/file-viewer/file-viewer-registry";

type ViewerStatus = "loading" | "initializing" | "ready" | "error";

interface StructurePageProps {
  params: Promise<{ path?: string[] }>;
}

export default function StructureViewerPage({ params }: StructurePageProps) {
  const { path } = use(params);
  const filePath = path ? `/${path.map(decodeURIComponent).join("/")}` : "";

  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<{ dispose: (opts?: object) => void } | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>();

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

        // Full Molstar viewer with all panels and controls enabled.
        const spec = {
          ...DefaultPluginUISpec(),
          layout: {
            initial: {
              isExpanded: false,
              showControls: true,
              controlsDisplay: "reactive" as const,
              regionState: {
                left: "full" as const,
                top: "full" as const,
                right: "full" as const,
                bottom: "full" as const,
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
  }, [filePath]);

  // Keep the WebGL canvas in sync with viewport size changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || status !== "ready") return;

    let resizePending = false;
    let rafId = 0;

    function syncSize() {
      if (resizePending) {
        resizePending = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pluginRef.current as any)?.canvas3d?.handleResize();
      }
      rafId = requestAnimationFrame(syncSize);
    }

    const observer = new ResizeObserver(() => {
      resizePending = true;
    });
    observer.observe(container);

    rafId = requestAnimationFrame(syncSize);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [status]);

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No file path provided.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
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
  );
}
