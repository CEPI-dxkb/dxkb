"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { usePanelRef } from "react-resizable-panels";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  graphCanvasMinWidth,
  graphColumnDefaults,
  graphColumnLimits,
} from "@/lib/interactions/graph-columns";
import { useUiPreference } from "@/lib/ui-preferences/provider";

interface GraphColumnsProps {
  list: ReactNode;
  canvas: ReactNode;
  details: ReactNode;
}

/**
 * The Graph view's three columns: the protein list, the canvas and the selection details. The two
 * side columns are dragged (or arrow-keyed, with a handle focused) between their limits and keep
 * their pixel width when the window changes size, so the canvas takes the difference. Double-click
 * a handle to restore its column's default. The widths are saved as a device preference.
 *
 * Each slot must fill its panel (`h-full`): the panel is the sized box, not the content.
 */
export function GraphColumns({ list, canvas, details }: GraphColumnsProps) {
  // The library writes a panel's id straight into the DOM, so namespace it per instance.
  const instanceId = useId();
  const [saved, setSaved] = useUiPreference("interactionsGraphColumns");
  // Read once per mount: while mounted the panels own their width, and the saved copy only
  // seeds the next visit.
  const [initial] = useState(saved);
  const listPanel = usePanelRef();
  const detailsPanel = usePanelRef();

  // Both column widths as drawn right now, saved as the device preference.
  function saveWidths() {
    const listWidth = listPanel.current?.getSize().inPixels;
    const detailsWidth = detailsPanel.current?.getSize().inPixels;
    if (listWidth === undefined || detailsWidth === undefined) return;
    setSaved({
      list: Math.round(listWidth),
      details: Math.round(detailsWidth),
    });
  }

  // Set by a double-click, so the layout that follows it is saved though it is not the user's drag.
  const savingReset = useRef(false);
  function resetColumn(panel: typeof listPanel, width: number) {
    savingReset.current = true;
    panel.current?.resize(width);
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="min-h-0 flex-1"
      onLayoutChanged={(_layout, meta) => {
        if (meta.isUserInteraction) {
          saveWidths();
          return;
        }
        // A programmatic resize is not reported as the user's, but a reset's is saved too: both
        // widths, because a column that cannot take its default (the other would drop under its
        // minimum) is moved by the library together with its neighbour. The widths the callback
        // reads are still the old ones, so they are read on the next frame, once drawn.
        if (!savingReset.current) return;
        savingReset.current = false;
        requestAnimationFrame(saveWidths);
      }}
    >
      <ResizablePanel
        id={`${instanceId}list`}
        panelRef={listPanel}
        defaultSize={initial.list}
        minSize={graphColumnLimits.list.min}
        maxSize={graphColumnLimits.list.max}
        groupResizeBehavior="preserve-pixel-size"
        className="relative min-h-0"
      >
        {list}
      </ResizablePanel>
      <ResizableHandle
        withHandle
        aria-label="Resize the protein list"
        onDoubleClick={() => {
          resetColumn(listPanel, graphColumnDefaults.list);
        }}
      />
      <ResizablePanel
        id={`${instanceId}canvas`}
        minSize={graphCanvasMinWidth}
        className="relative min-h-0 min-w-0"
      >
        {canvas}
      </ResizablePanel>
      <ResizableHandle
        withHandle
        aria-label="Resize the selection details"
        onDoubleClick={() => {
          resetColumn(detailsPanel, graphColumnDefaults.details);
        }}
      />
      <ResizablePanel
        id={`${instanceId}details`}
        panelRef={detailsPanel}
        defaultSize={initial.details}
        minSize={graphColumnLimits.details.min}
        maxSize={graphColumnLimits.details.max}
        groupResizeBehavior="preserve-pixel-size"
        className="relative min-h-0"
      >
        {details}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
