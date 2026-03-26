"use client";

import { useEffect, useState } from "react";
import { JsonView, allExpanded, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { Braces, Code } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getProxyUrl, interactiveViewerSizeLimit } from "../file-viewer-registry";
import { TextViewer } from "./text-viewer";

interface JsonViewerProps {
  filePath: string;
  fileName: string;
  fileSize?: number;
}

export function JsonViewer({ filePath, fileName, fileSize }: JsonViewerProps) {
  if (fileSize && fileSize > interactiveViewerSizeLimit) {
    return <TextViewer filePath={filePath} fileName={fileName} fileSize={fileSize} />;
  }

  return <InteractiveJsonViewer filePath={filePath} fileName={fileName} />;
}

function InteractiveJsonViewer({ filePath, fileName }: { filePath: string; fileName: string }) {
  const [data, setData] = useState<unknown>(undefined);
  const [rawText, setRawText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [isPrimitive, setIsPrimitive] = useState(false);
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchJson() {
      setIsLoading(true);
      setError(null);
      setParseError(false);
      setParseSuccess(false);
      setIsPrimitive(false);

      try {
        const response = await fetch(getProxyUrl(filePath), {
          signal: controller.signal,
          credentials: "include",
        });

        if (!response.ok) {
          setError(`Failed to load ${fileName}: ${response.statusText}`);
          return;
        }

        const text = await response.text();
        setRawText(text);

        try {
          const parsed: unknown = JSON.parse(text);
          if (
            parsed !== null &&
            typeof parsed === "object"
          ) {
            setData(parsed);
            setParseSuccess(true);
          } else {
            setIsPrimitive(true);
          }
        } catch {
          setParseError(true);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchJson();

    return () => controller.abort();
  }, [filePath, fileName]);

  return (
    <div className="flex h-full w-full flex-col">
      {parseSuccess && (
        <div className="flex items-center gap-1 border-b border-border px-2 py-1">
          <Button
            variant={viewMode === "tree" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("tree")}
          >
            <Braces className="mr-1 h-4 w-4" />
            Tree
          </Button>
          <Button
            variant={viewMode === "raw" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("raw")}
          >
            <Code className="mr-1 h-4 w-4" />
            Raw
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {isLoading && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Loading...
          </div>
        )}

        {!isLoading && error && (
          <div className="flex h-full items-center justify-center text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && parseError && (
          <div className="flex h-full flex-col gap-2">
            <p className="text-sm text-warning">
              Warning: JSON parsing failed. Showing raw text instead.
            </p>
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
              {rawText}
            </pre>
          </div>
        )}

        {!isLoading && !error && isPrimitive && (
          <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
            {rawText}
          </pre>
        )}

        {!isLoading && !error && !parseError && !isPrimitive && viewMode === "tree" && parseSuccess && (
          <JsonView
            data={data as Record<string, unknown>}
            shouldExpandNode={allExpanded}
            style={defaultStyles}
          />
        )}

        {!isLoading && !error && !parseError && !isPrimitive && viewMode === "raw" && (
          <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
            {rawText}
          </pre>
        )}
      </div>
    </div>
  );
}
