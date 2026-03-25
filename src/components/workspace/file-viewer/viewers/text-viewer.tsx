"use client";

import { useEffect, useReducer, useCallback } from "react";
import { codeToHtml } from "shiki";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatFileSize } from "@/lib/services/workspace/helpers";
import { getProxyUrl, getPreviewUrl, interactiveViewerSizeLimit } from "../file-viewer-registry";

interface TextViewerProps {
  filePath: string;
  fileName: string;
  fileSize?: number;
}

const maxHighlightLines = 5_000;

function truncateText(text: string, maxLines = maxHighlightLines) {
  const lines = text.split("\n");
  if (lines.length <= maxLines) {
    return { content: text, truncated: false, totalLines: lines.length };
  }
  return {
    content: lines.slice(0, maxLines).join("\n"),
    truncated: true,
    totalLines: lines.length,
  };
}

function getLangFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return "text";

  const ext = fileName.slice(dot).toLowerCase();

  switch (ext) {
    case ".json":
      return "json";
    case ".xml":
    case ".svg":
      return "xml";
    case ".csv":
    case ".tsv":
      return "csv";
    case ".html":
    case ".htm":
      return "html";
    default:
      return "text";
  }
}

interface State {
  isLoading: boolean;
  error: string | null;
  content: string | null;
  highlightedHtml: string | null;
  truncated: boolean;
  serverTruncated: boolean;
  totalLines: number;
}

type Action =
  | { type: "fetch_start" }
  | {
      type: "fetch_success";
      content: string;
      truncated: boolean;
      serverTruncated: boolean;
      totalLines: number;
    }
  | { type: "fetch_error"; error: string }
  | { type: "highlight_done"; html: string };

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case "fetch_start":
      return {
        isLoading: true,
        error: null,
        content: null,
        highlightedHtml: null,
        truncated: false,
        serverTruncated: false,
        totalLines: 0,
      };
    case "fetch_success":
      return {
        isLoading: false,
        error: null,
        content: action.content,
        highlightedHtml: null,
        truncated: action.truncated,
        serverTruncated: action.serverTruncated,
        totalLines: action.totalLines,
      };
    case "fetch_error":
      return {
        isLoading: false,
        error: action.error,
        content: null,
        highlightedHtml: null,
        truncated: false,
        serverTruncated: false,
        totalLines: 0,
      };
    case "highlight_done":
      return { ..._state, highlightedHtml: action.html };
  }
}

const initialState: State = {
  isLoading: true,
  error: null,
  content: null,
  highlightedHtml: null,
  truncated: false,
  serverTruncated: false,
  totalLines: 0,
};

function processResponse(res: Response, maxLines = maxHighlightLines) {
  if (!res.ok) throw new Error(`Failed to load file (HTTP ${res.status})`);
  const serverTruncated = res.headers.get("X-Truncated") === "true";
  return res.text().then((text) => {
    const { content, truncated, totalLines } = truncateText(text, maxLines);
    return {
      content,
      truncated: truncated || serverTruncated,
      serverTruncated,
      totalLines,
    };
  });
}

export function TextViewer({ filePath, fileName, fileSize }: TextViewerProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const maxLines =
    fileSize && fileSize <= interactiveViewerSizeLimit
      ? Infinity
      : maxHighlightLines;

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "fetch_start" });

    fetch(getPreviewUrl(filePath), { signal: controller.signal })
      .then((res) => processResponse(res, maxLines))
      .then((result) => {
        dispatch({ type: "fetch_success", ...result });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatch({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "An unknown error occurred",
        });
      });

    return () => controller.abort();
  }, [filePath, maxLines]);

  useEffect(() => {
    if (state.content === null) return;

    let cancelled = false;

    codeToHtml(state.content, {
      lang: getLangFromFileName(fileName),
      theme: "github-dark",
    })
      .then((html) => {
        if (!cancelled) dispatch({ type: "highlight_done", html });
      })
      .catch(() => {
        if (!cancelled && state.content !== null) {
          const escaped = state.content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          dispatch({
            type: "highlight_done",
            html: `<pre><code>${escaped}</code></pre>`,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.content, fileName]);

  const handleRetry = useCallback(() => {
    dispatch({ type: "fetch_start" });
    fetch(getPreviewUrl(filePath))
      .then((res) => processResponse(res, maxLines))
      .then((result) => {
        dispatch({ type: "fetch_success", ...result });
      })
      .catch((err: unknown) => {
        dispatch({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "An unknown error occurred",
        });
      });
  }, [filePath, maxLines]);

  if (state.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center gap-2 text-muted-foreground">
        Loading... <Spinner />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <p className="text-destructive">{state.error}</p>
        <Button variant="outline" onClick={handleRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!state.highlightedHtml) {
    return (
      <div className="flex h-full w-full items-center justify-center gap-2 text-muted-foreground">
        Highlighting... <Spinner />
      </div>
    );
  }

  const truncationMessage = state.serverTruncated
    ? `Showing first ~${state.totalLines.toLocaleString()} lines${fileSize ? ` of a ${formatFileSize(fileSize)} file` : ""}.`
    : `Showing first ${maxHighlightLines.toLocaleString()} of ${state.totalLines.toLocaleString()} lines.`;

  return (
    <div className="h-full w-full overflow-auto">
      <div
        className="min-w-0 p-4 text-sm [content-visibility:auto] [contain-intrinsic-size:auto_500px] [&_pre]:bg-transparent! [&_code]:text-sm [&_.shiki]:text-foreground!"
        // Safe: HTML is generated by Shiki (trusted syntax highlighting library), not user input
        dangerouslySetInnerHTML={{ __html: state.highlightedHtml }}
      />
      {state.truncated && fileSize && fileSize > interactiveViewerSizeLimit && (
        <div className="sticky bottom-0 border-t border-border bg-primary/80 px-4 py-2 text-center text-sm text-primary-foreground backdrop-blur-sm">
          {truncationMessage}{" "}
          <a
            href={getProxyUrl(filePath)}
            download
            className="text-primary-foreground font-bold underline underline-offset-2 hover:text-accent transition-all duration-200"
          >
            Download full file
          </a>
        </div>
      )}
    </div>
  );
}
