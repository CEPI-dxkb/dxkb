"use client";

import { useEffect, useState } from "react";
import type { StructureSource } from "@/lib/protein-structure-view/source";
import { MolstarStatusOverlay } from "./molstar-status-overlay";
import { useMolstarPlugin, type MolstarLayoutSpec } from "./use-molstar-plugin";

interface StructureSourceViewerProps {
  source: StructureSource;
  sources?: readonly StructureSource[];
  layout: MolstarLayoutSpec;
  containerClassName?: string;
}

interface ActiveStructureSourceViewerProps {
  source: StructureSource;
  layout: MolstarLayoutSpec;
  containerClassName: string;
  hasNext: boolean;
  onFailure: () => void;
  onRetry: () => void;
  retryFromStart: boolean;
}

function ActiveStructureSourceViewer({
  source,
  layout,
  containerClassName,
  hasNext,
  onFailure,
  onRetry,
  retryFromStart,
}: ActiveStructureSourceViewerProps) {
  const { containerRef, status, errorMessage, resetError } = useMolstarPlugin(
    source,
    layout,
  );
  useEffect(() => {
    if (status === "error" && hasNext) onFailure();
  }, [hasNext, onFailure, status]);

  return (
    <>
      <div
        ref={containerRef}
        className={containerClassName}
        data-molstar-viewer
        data-testid="molstar-container"
      />
      <MolstarStatusOverlay
        status={status === "error" && hasNext ? "loading" : status}
        errorMessage={errorMessage}
        onRetry={retryFromStart ? onRetry : resetError}
      />
    </>
  );
}

export function StructureSourceViewer({
  source,
  sources,
  layout,
  containerClassName = "relative isolate min-h-0 flex-1 overflow-hidden",
}: StructureSourceViewerProps) {
  const candidates = sources?.length ? sources : [source];
  const candidateKey = candidates.map((candidate) => candidate.url).join("\n");
  const [selection, setSelection] = useState({ key: candidateKey, index: 0 });
  const candidateIndex = selection.key === candidateKey ? selection.index : 0;
  const activeSource = candidates[candidateIndex] ?? source;

  return (
    <ActiveStructureSourceViewer
      key={activeSource.url}
      source={activeSource}
      layout={layout}
      containerClassName={containerClassName}
      hasNext={candidateIndex < candidates.length - 1}
      retryFromStart={candidates.length > 1 && candidateIndex === candidates.length - 1}
      onFailure={() => {
        setSelection({ key: candidateKey, index: candidateIndex + 1 });
      }}
      onRetry={() => {
        setSelection({ key: candidateKey, index: 0 });
      }}
    />
  );
}
