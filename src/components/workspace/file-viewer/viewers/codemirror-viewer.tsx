"use client";

import { useEffect, useRef, useState } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  foldGutter,
  foldAll,
  foldKeymap,
} from "@codemirror/language";
import { keymap } from "@codemirror/view";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { triggerDownload } from "@/lib/utils";
import { formatFileSize } from "@/lib/services/workspace/helpers";
import { getProxyUrl } from "../file-viewer-registry";
import { getLanguageExtension } from "./codemirror-languages";
import { LoadingProgress } from "./loading-progress";

const largeFileThreshold = 50 * 1024 * 1024; // 50 MB

interface CodeMirrorViewerProps {
  filePath: string;
  fileName: string;
  fileSize?: number;
  foldable?: boolean;
  startFolded?: boolean;
}

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    overflow: "auto",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid var(--border)",
    color: "var(--muted-foreground)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklch, var(--muted) 50%, transparent)",
  },
  ".cm-cursor": {
    display: "none",
  },
  ".cm-content": {
    padding: "8px 0",
  },
  ".cm-line": {
    padding: "0 16px 0 8px",
  },
  ".cm-foldGutter .cm-gutterElement": {
    cursor: "pointer",
    padding: "0 4px",
    color: "var(--muted-foreground)",
    fontSize: "12px",
    lineHeight: "inherit",
    transition: "color 0.15s",
  },
  ".cm-foldGutter .cm-gutterElement:hover": {
    color: "var(--foreground)",
  },
});

const readOnlyExtensions: Extension[] = [
  EditorView.editable.of(false),
  EditorState.readOnly.of(true),
  EditorView.lineWrapping,
  baseTheme,
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
];

const foldExtensions: Extension[] = [
  foldGutter({
    openText: "▼",
    closedText: "▶",
  }),
  keymap.of(foldKeymap),
];

// ---------------------------------------------------------------------------
// EditorView cache — keeps recently viewed files alive so switching back is
// instant instead of re-downloading and re-parsing the entire file.
// ---------------------------------------------------------------------------

interface CachedEntry {
  view: EditorView;
  wrapper: HTMLDivElement;
  status: "loading" | "streaming" | "done" | "error";
  abort: AbortController;
}

const viewCache = new Map<string, CachedEntry>();
const maxCacheSize = 5;

function evictOldest() {
  if (viewCache.size <= maxCacheSize) return;

  // Prefer evicting unmounted entries first
  for (const [key, entry] of viewCache) {
    if (!entry.wrapper.isConnected) {
      entry.abort.abort();
      entry.view.destroy();
      viewCache.delete(key);
      if (viewCache.size <= maxCacheSize) return;
    }
  }

  // All entries are mounted — force-evict the oldest to cap memory
  if (viewCache.size > maxCacheSize) {
    const oldest = viewCache.entries().next().value;
    if (oldest) {
      const [key, entry] = oldest;
      entry.abort.abort();
      entry.view.destroy();
      viewCache.delete(key);
    }
  }
}

export function CodeMirrorViewer({
  filePath,
  fileName,
  fileSize,
  foldable = false,
  startFolded = false,
}: CodeMirrorViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState<{
    bytesLoaded: number;
    totalBytes: number | null;
  }>({ bytesLoaded: 0, totalBytes: null });
  const [status, setStatus] = useState<
    "loading" | "streaming" | "done" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Large file confirmation gate
  const [confirmedPath, setConfirmedPath] = useState<string | null>(null);
  const isLargeFile =
    fileSize !== undefined && fileSize >= largeFileThreshold;
  const needsConfirmation =
    isLargeFile && confirmedPath !== filePath && !viewCache.has(filePath);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || needsConfirmation) return;

    // Check cache for an existing EditorView for this file
    const cached = viewCache.get(filePath);
    if (cached) {
      container.appendChild(cached.wrapper);
      setStatus(cached.status);
      setProgress({ bytesLoaded: 0, totalBytes: null });
      setErrorMsg(null);
      return () => {
        // Detach but don't destroy — keep in cache
        if (cached.wrapper.parentNode === container) {
          container.removeChild(cached.wrapper);
        }
      };
    }

    // No cache hit — create a new EditorView and start streaming
    let destroyed = false;
    const controller = new AbortController();
    const wrapper = document.createElement("div");
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";
    container.appendChild(wrapper);

    const entry: CachedEntry = {
      view: null as unknown as EditorView,
      wrapper,
      status: "loading",
      abort: controller,
    };

    async function init() {
      const langExt = await getLanguageExtension(fileName);
      if (destroyed) return;

      const extensions = [...readOnlyExtensions];
      if (foldable) extensions.push(...foldExtensions);
      if (langExt) extensions.push(langExt);

      const state = EditorState.create({ doc: "", extensions });
      const view = new EditorView({ state, parent: wrapper });
      entry.view = view;

      // Store in cache early so it's available even during streaming
      viewCache.set(filePath, entry);
      evictOldest();

      try {
        const response = await fetch(getProxyUrl(filePath), {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load file (HTTP ${response.status})`);
        }

        const contentLength = response.headers.get("Content-Length");
        const total = contentLength ? parseInt(contentLength, 10) : null;
        setProgress((prev) => ({ ...prev, totalBytes: total }));

        const body = response.body;
        if (!body) {
          const text = await response.text();
          if (destroyed || !view) return;
          view.dispatch({ changes: { from: 0, insert: text } });
          if (startFolded) foldAll(view);
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
          if (destroyed || !view || pendingText.length === 0) return;
          const text = pendingText;
          const from = docLength;
          pendingText = "";
          docLength += text.length;
          view.dispatch({ changes: { from, insert: text } });
          setProgress({ bytesLoaded: loaded, totalBytes: total });
        }

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (destroyed) return;

          loaded += value.byteLength;
          pendingText += decoder.decode(value, { stream: true });

          if (!rafScheduled) {
            rafScheduled = true;
            requestAnimationFrame(flushToEditor);
          }
        }

        pendingText += decoder.decode();
        flushToEditor();

        if (!destroyed) {
          if (startFolded) foldAll(view);
          entry.status = "done";
          setStatus("done");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!destroyed) {
          entry.status = "error";
          setErrorMsg(
            err instanceof Error ? err.message : "An unknown error occurred",
          );
          setStatus("error");
          // Don't cache failed loads
          viewCache.delete(filePath);
        }
      }
    }

    init();

    return () => {
      destroyed = true;
      // Detach wrapper from container but keep it alive in cache
      if (wrapper.parentNode === container) {
        container.removeChild(wrapper);
      }
      // Completed entries stay in cache for instant re-display.
      // Anything else (loading, streaming) must be aborted and removed.
      if (entry.status !== "done") {
        controller.abort();
        if (entry.view) entry.view.destroy();
        viewCache.delete(filePath);
      }
    };
  }, [fileName, filePath, foldable, startFolded, needsConfirmation]);

  if (needsConfirmation) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-accent" />
        <div className="space-y-1">
          <p className="text-sm font-medium">
            Large File ({fileSize ? formatFileSize(fileSize) : "50+ MB"})
          </p>
          <p className="text-xs text-muted-foreground">
            This file is large and may take a while to download and render.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="lg" variant="default" onClick={() => setConfirmedPath(filePath)}>
            Preview
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => triggerDownload(getProxyUrl(filePath))}
          >
            Download
          </Button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <p className="text-destructive">{errorMsg}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {status === "streaming" && progress.bytesLoaded > 0 && (
        <LoadingProgress
          bytesLoaded={progress.bytesLoaded}
          totalBytes={progress.totalBytes ?? fileSize ?? null}
        />
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
