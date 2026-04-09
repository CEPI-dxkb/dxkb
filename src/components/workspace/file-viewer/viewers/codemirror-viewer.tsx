"use client";

import { useEffect, useRef, useState } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  syntaxHighlighting,
  HighlightStyle,
  foldGutter,
  foldAll,
  foldKeymap,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { keymap } from "@codemirror/view";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { triggerDownload } from "@/lib/utils";
import { formatFileSize } from "@/lib/services/workspace/helpers";
import { getProxyUrl } from "../file-viewer-registry";
import { getLanguageExtension } from "./codemirror-languages";
import { LoadingProgress } from "./loading-progress";

const largeFileThreshold = 10 * 1024 * 1024; // 10 MB

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

// GitHub syntax highlight colors — keyed [dark, light] per tag group
const githubColors = {
  keyword:    ["#ff7b72", "#cf222e"],
  name:       ["#c9d1d9", "#24292f"],
  function:   ["#d2a8ff", "#8250df"],
  constant:   ["#79c0ff", "#0550ae"],
  type:       ["#ffa657", "#953800"],
  number:     ["#79c0ff", "#0550ae"],
  string:     ["#a5d6ff", "#0a3069"],
  comment:    ["#8b949e", "#6e7781"],
  property:   ["#7ee787", "#116329"],
  punctuation:["#8b949e", "#6e7781"],
} as const;

function buildHighlightStyle(mode: 0 | 1) {
  const c = (key: keyof typeof githubColors) => githubColors[key][mode];
  return HighlightStyle.define([
    { tag: tags.keyword, color: c("keyword") },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: c("name") },
    { tag: [tags.function(tags.variableName), tags.labelName], color: c("function") },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: c("constant") },
    { tag: [tags.definition(tags.name), tags.separator], color: c("name") },
    { tag: [tags.typeName, tags.className, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: c("type") },
    { tag: [tags.number, tags.bool], color: c("number") },
    { tag: [tags.string, tags.special(tags.brace)], color: c("string") },
    { tag: tags.operator, color: c("keyword") },
    { tag: tags.comment, color: c("comment"), fontStyle: "italic" },
    { tag: tags.meta, color: c("constant") },
    { tag: tags.strong, fontWeight: "bold" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.link, color: c("string"), textDecoration: "underline" },
    { tag: tags.propertyName, color: c("property") },
    { tag: tags.atom, color: c("constant") },
    { tag: tags.punctuation, color: c("punctuation") },
  ]);
}

const githubDarkStyle = buildHighlightStyle(0);
const githubLightStyle = buildHighlightStyle(1);

function isDarkTheme() {
  if (typeof document === "undefined") return true;
  return (document.documentElement.getAttribute("data-theme") ?? "").endsWith("-dark");
}

const highlightCompartment = new Compartment();

function highlightExtFor(dark: boolean) {
  return syntaxHighlighting(dark ? githubDarkStyle : githubLightStyle, { fallback: true });
}

const readOnlyExtensions: Extension[] = [
  EditorView.editable.of(false),
  EditorState.readOnly.of(true),
  // EditorView.lineWrapping,
  baseTheme,
  highlightCompartment.of(highlightExtFor(isDarkTheme())),
];

const foldExtensions: Extension[] = [
  foldGutter({
    openText: "▼",
    closedText: "▶",
  }),
  keymap.of(foldKeymap),
];

// Watches data-theme on <html> and reconfigures all cached editor views.
let lastDark: boolean | null = null;

function startThemeObserver() {
  if (lastDark !== null || typeof document === "undefined") return;
  lastDark = isDarkTheme();

  new MutationObserver(() => {
    const dark = isDarkTheme();
    if (dark === lastDark) return;
    lastDark = dark;
    const ext = highlightExtFor(dark);
    for (const entry of viewCache.values()) {
      entry.view?.dispatch({ effects: highlightCompartment.reconfigure(ext) });
    }
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

// ---------------------------------------------------------------------------
// EditorView cache — keeps recently viewed files alive so switching back is
// instant instead of re-downloading and re-parsing the entire file.
// ---------------------------------------------------------------------------

interface CachedEntry {
  view: EditorView;
  wrapper: HTMLDivElement;
  status: "loading" | "streaming" | "done" | "error";
  abort: AbortController;
  truncated: boolean;
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
  const fileSizeRef = useRef(fileSize);
  fileSizeRef.current = fileSize;
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
    const container = containerRef.current;
    if (!container) return;

    // Check cache for an existing EditorView for this file
    const cached = viewCache.get(filePath);
    if (cached) {
      container.appendChild(cached.wrapper);
      setStatus(cached.status);
      setTruncated(cached.truncated);
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
      truncated: false,
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
      startThemeObserver();

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

        let wasTruncated = false;

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

          if (loaded >= largeFileThreshold) {
            wasTruncated = true;
            reader.cancel();
            break;
          }
        }

        pendingText += decoder.decode();
        flushToEditor();

        if (!destroyed) {
          if (wasTruncated) {
            const divider = "─".repeat(60);
            const sizeLabel = fileSizeRef.current ? formatFileSize(fileSizeRef.current) : "full file";
            const marker = `\n${divider}\n  Preview truncated at ${formatFileSize(largeFileThreshold)} of ${sizeLabel}. Download for complete content.\n${divider}`;
            view.dispatch({ changes: { from: view.state.doc.length, insert: marker } });
          }
          if (startFolded) foldAll(view);
          entry.truncated = wasTruncated;
          setTruncated(wasTruncated);
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
  }, [fileName, filePath, foldable, startFolded]);

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
      {truncated && (
        <div className="flex items-center justify-between gap-2 border-b bg-primary/90 px-3 py-1.5 text-xs font-medium text-white">
          <span>
            Preview truncated to {formatFileSize(largeFileThreshold)} of{" "}
            {fileSize ? formatFileSize(fileSize) : "full file"}.
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-0.5 text-xs font-bold hover:bg-accent/90 hover:text-white"
            onClick={() => triggerDownload(getProxyUrl(filePath))}
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
