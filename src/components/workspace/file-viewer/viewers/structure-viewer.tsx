"use client";

import { ExpandableViewerWrapper } from "./expandable-viewer-wrapper";
import { MolstarStatusOverlay } from "./molstar-status-overlay";
import {
  useMolstarPlugin,
  type MolstarLayoutSpec,
} from "./use-molstar-plugin";

interface StructureViewerProps {
  filePath: string;
  fileName: string;
}

const embeddedLayout: MolstarLayoutSpec = {
  showControls: false,
  regionState: "hidden",
};

export function StructureViewer({ filePath, fileName }: StructureViewerProps) {
  const { containerRef, status, errorMessage, resetError } = useMolstarPlugin(
    filePath,
    embeddedLayout,
  );

  return (
    <ExpandableViewerWrapper title={fileName}>
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-b-lg">
        <div
          ref={containerRef}
          className="isolate relative min-h-0 flex-1 overflow-hidden"
          data-testid="molstar-container"
        />
        <MolstarStatusOverlay
          status={status}
          errorMessage={errorMessage}
          onRetry={resetError}
          compact
        />
      </div>
    </ExpandableViewerWrapper>
  );
}
