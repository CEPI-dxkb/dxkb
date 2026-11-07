"use client";

import { useEffect, useRef, useState } from "react";

import type { CachedEntry } from "./codemirror-loader";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { triggerDownload } from "@/lib/utils";
import { formatFileSize } from "@/lib/services/workspace/helpers";
import { getProxyUrl } from "../file-viewer-registry";
import { LoadingProgress } from "./loading-progress";

const largeFileThreshold = 10 * 1024 * 1024; // 10 MB

// The helpers below are module-level on purpose: a dynamic `import()`, a
// `throw` or ternary inside `try`, and a `for (;;)` loop each make the React
// Compiler skip the whole component, so they must not move back into it.

// Loaded lazily so the editor bundle stays out of the initial chunk.
function loadCodeMirror() {
  return import("./codemirror-loader");
}

function dropCachedView(filePath: string): void {
  void loadCodeMirror().then(({ viewCache }) => {
    viewCache.delete(filePath);
  });
}

function assertResponseOk(response: Response): void {
  if (!response.ok) {
    throw new Error(`Failed to load file (HTTP ${String(response.status)})`);
  }
}

function parseContentLength(header: string | null): number | null {
  return header ? parseInt(header, 10) : null;
}

function truncationMarker(fileSize: number | undefined): string {
  const divider = "─".repeat(60);
  const sizeLabel = fileSize ? formatFileSize(fileSize) : "full file";
  return `\n${divider}\n  Preview truncated at ${formatFileSize(largeFileThreshold)} of ${sizeLabel}. Download for complete content.\n${divider}`;
}

/**
 * Reads the body chunk by chunk, handing each decoded chunk and the running
 * byte count to `onChunk`. Stops early at the large-file threshold.
 */
async function readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  isDestroyed: () => boolean,
  onChunk: (text: string, loaded: number) => void,
): Promise<"destroyed" | "truncated" | "complete"> {
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return "complete";
    if (isDestroyed()) return "destroyed";

    loaded += value.byteLength;
    onChunk(decoder.decode(value, { stream: true }), loaded);

    if (loaded >= largeFileThreshold) {
      void reader.cancel();
      return "truncated";
    }
  }
}

interface CodeMirrorViewerProps {
  filePath: string;
  fileName: string;
  fileSize?: number;
  foldable?: boolean;
  startFolded?: boolean;
}

export function CodeMirrorViewer({
  filePath,
  fileName,
  fileSize,
  foldable = false,
  startFolded = false,
}: CodeMirrorViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileSizeRef = useRef(fileSize);
  useEffect(() => {
    fileSizeRef.current = fileSize;
  }, [fileSize]);
  const [progress, setProgress] = useState<{
    bytesLoaded: number;
    totalBytes: number | null;
  }>({ bytesLoaded: 0, totalBytes: null });
  const [status, setStatus] = useState<
    "loading" | "streaming" | "done" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;
    const container = currentContainer;

    const lifecycle = { destroyed: false };
    const isDestroyed = (): boolean => lifecycle.destroyed;
    const controller = new AbortController();
    let entry: CachedEntry | null = null;

    async function init() {
      const codeMirror = await loadCodeMirror();
      if (isDestroyed()) return;

      const cached = codeMirror.viewCache.get(filePath);
      if (cached) {
        entry = cached;
        container.appendChild(cached.wrapper);
        setStatus(cached.status);
        setTruncated(cached.truncated);
        setProgress({ bytesLoaded: 0, totalBytes: null });
        setErrorMsg(null);
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.style.height = "100%";
      wrapper.style.width = "100%";
      container.appendChild(wrapper);
      entry = {
        view: null,
        wrapper,
        status: "loading",
        abort: controller,
        truncated: false,
      };

      const view = await codeMirror.createEditor(fileName, foldable, wrapper);
      if (isDestroyed()) {
        view.destroy();
        return;
      }
      entry.view = view;

      codeMirror.viewCache.set(filePath, entry);
      codeMirror.evictOldest();
      codeMirror.startThemeObserver();

      try {
        const response = await fetch(getProxyUrl(filePath), {
          signal: controller.signal,
        });
        if (isDestroyed()) return;

        assertResponseOk(response);

        const total = parseContentLength(
          response.headers.get("Content-Length"),
        );
        setProgress((prev) => ({ ...prev, totalBytes: total }));

        const body = response.body;
        if (!body) {
          const text = await response.text();
          if (isDestroyed()) return;
          view.dispatch({ changes: { from: 0, insert: text } });
          if (startFolded) codeMirror.foldAll(view);
          entry.status = "done";
          setStatus("done");
          return;
        }

        entry.status = "streaming";
        setStatus("streaming");
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let docLength = 0;
        let loaded = 0;

        let pendingText = "";
        let rafScheduled = false;

        function flushToEditor() {
          rafScheduled = false;
          if (isDestroyed() || pendingText.length === 0) return;
          const text = pendingText;
          const from = docLength;
          pendingText = "";
          docLength += text.length;
          view.dispatch({ changes: { from, insert: text } });
          setProgress({ bytesLoaded: loaded, totalBytes: total });
        }

        const outcome = await readStream(
          reader,
          decoder,
          isDestroyed,
          (text, loadedSoFar) => {
            loaded = loadedSoFar;
            pendingText += text;

            if (!rafScheduled) {
              rafScheduled = true;
              requestAnimationFrame(flushToEditor);
            }
          },
        );
        if (outcome === "destroyed") return;
        const wasTruncated = outcome === "truncated";

        pendingText += decoder.decode();
        flushToEditor();

        if (!isDestroyed()) {
          if (wasTruncated) {
            view.dispatch({
              changes: {
                from: view.state.doc.length,
                insert: truncationMarker(fileSizeRef.current),
              },
            });
          }
          if (startFolded) codeMirror.foldAll(view);
          entry.truncated = wasTruncated;
          setTruncated(wasTruncated);
          entry.status = "done";
          setStatus("done");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!isDestroyed()) {
          entry.status = "error";
          setErrorMsg(
            err instanceof Error ? err.message : "An unknown error occurred",
          );
          setStatus("error");
          // Don't cache failed loads
          codeMirror.viewCache.delete(filePath);
        }
      }
    }

    void init().catch((err: unknown) => {
      if (isDestroyed()) return;
      if (entry) entry.status = "error";
      setErrorMsg(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
      setStatus("error");
    });

    return () => {
      lifecycle.destroyed = true;
      // Completed entries stay in cache for instant re-display.
      if (entry?.wrapper.parentNode === container) {
        container.removeChild(entry.wrapper);
      }
      if (entry && entry.status !== "done") {
        controller.abort();
        entry.view?.destroy();
        dropCachedView(filePath);
      }
    };
  }, [fileName, filePath, foldable, startFolded]);

  if (status === "error") {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3">
        <p className="text-destructive">{errorMsg}</p>
        <Button
          variant="outline"
          onClick={() => {
            window.location.reload();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex size-full flex-col">
      {status === "streaming" && progress.bytesLoaded > 0 && (
        <LoadingProgress
          bytesLoaded={progress.bytesLoaded}
          totalBytes={progress.totalBytes ?? fileSize ?? null}
        />
      )}
      {truncated && (
        <div className="flex items-center justify-between gap-2 border-b bg-primary/90 px-3 py-1.5 text-xs font-medium text-white">
          <span>
            Preview truncated to {formatFileSize(largeFileThreshold)} of{" "}
            {fileSize ? formatFileSize(fileSize) : "full file"}.
          </span>
          <Button
            variant="banner"
            size="banner"
            onClick={() => {
              triggerDownload(getProxyUrl(filePath));
            }}
          >
            Download full file
          </Button>
        </div>
      )}
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground">
          Loading... <Spinner />
        </div>
      )}
    </div>
  );
}
