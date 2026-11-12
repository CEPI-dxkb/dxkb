"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useUiPreference } from "@/lib/ui-preferences/provider";

interface ResourceWorkspaceProps {
  children: ReactNode;
  toolbar?: ReactNode;
  sidePanel: ReactNode;
  actionBar?: ReactNode;
  hasSidePanel?: boolean;
  hasActionRail?: boolean;
  /** Tooltip on the disabled Show toggle while there is nothing to show. */
  emptySelectionHint?: string;
}

/**
 * Matches Tailwind's `md` breakpoint so the `max-md:` utilities flip in the
 * same place.
 */
const narrowWorkspaceQuery = "(max-width: 47.999rem)";

/**
 * `panelId` is load-bearing: `ResizablePanelGroup` restores a layout cached per
 * joined panel-id key in preference to `defaultSize`, so a layout whose sizes
 * change must change the key too.
 */
const detailPanelSizes = {
  stacked: {
    panelId: "detail-stacked",
    defaultSize: "45%",
    minSize: "25%",
    maxSize: "60%",
  },
  sideBySide: {
    panelId: "detail-side",
    defaultSize: "15%",
    minSize: "10%",
    maxSize: "60%",
  },
} as const;

/**
 * One element tree in both layouts: crossing `narrowWorkspaceQuery` only
 * changes props and `max-md:` classes, because React cannot reconcile a subtree
 * across different ancestor types and a separate narrow tree would discard
 * table and dialog state on every resize.
 */
export function ResourceWorkspace({
  children,
  toolbar,
  sidePanel,
  actionBar,
  hasSidePanel = true,
  hasActionRail = true,
  emptySelectionHint = "Select a row to show its details",
}: ResourceWorkspaceProps) {
  // The library writes a panel's id straight into the DOM, so namespace it to
  // avoid duplicate ids across workspaces.
  const instanceId = useId();
  const [savedDetailSize, setSavedDetailSize] = useUiPreference(
    "resourceDetailPanelSize",
  );
  const [sideBySideDefaultSize] = useState(
    () => `${String(savedDetailSize)}%`,
  );
  const [panelExpanded, setPanelExpanded] = useState(hasSidePanel);
  const [isNarrow, setIsNarrow] = useState(false);
  const [previousHasSidePanel, setPreviousHasSidePanel] =
    useState(hasSidePanel);
  if (previousHasSidePanel !== hasSidePanel) {
    setPreviousHasSidePanel(hasSidePanel);
    if (hasSidePanel) setPanelExpanded(true);
  }

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(narrowWorkspaceQuery);
    const update = () => {
      setIsNarrow(mediaQuery.matches);
    };
    update();
    mediaQuery.addEventListener("change", update);
    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  const detailSizes = isNarrow
    ? detailPanelSizes.stacked
    : { ...detailPanelSizes.sideBySide, defaultSize: sideBySideDefaultSize };
  const detailPanelId = `${instanceId}${detailSizes.panelId}`;

  return (
    <div
      // Read by tests to tell the responsive modes apart.
      data-layout={isNarrow ? "stacked" : "resizable"}
      className="flex min-h-0 w-full flex-1 overflow-hidden"
    >
      <ResizablePanelGroup
        orientation={isNarrow ? "vertical" : "horizontal"}
        disabled={isNarrow}
        className="size-full min-h-0"
        onLayoutChanged={(layout, meta) => {
          if (!meta.isUserInteraction || isNarrow) return;
          const size = layout[detailPanelId] ?? 0;
          if (size > 0) setSavedDetailSize(size);
        }}
      >
        <ResizablePanel
          minSize="20%"
          className="flex min-h-0 min-w-0 overflow-hidden max-md:flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {toolbar}
            {children}
          </div>
          {hasActionRail && (
            <aside className="shrink-0 max-md:max-h-20 max-md:min-w-0">
              <div className="flex h-full min-h-0 w-20 shrink-0 flex-col rounded-l-lg border-l bg-muted max-md:h-20 max-md:w-full max-md:flex-row max-md:rounded-l-none max-md:border-t max-md:border-l-0">
                <div className="border-b p-2 max-md:border-r max-md:border-b-0">
                  {hasSidePanel ? (
                    <Button
                      variant="ghost"
                      size="rail"
                      onClick={() => {
                        setPanelExpanded((current) => !current);
                      }}
                      title={panelExpanded ? "Hide panel" : "Show panel"}
                      className="flex w-full flex-col items-center max-md:w-16"
                    >
                      {panelExpanded ? (
                        <PanelRightClose className="size-4" />
                      ) : (
                        <PanelRightOpen className="size-4" />
                      )}
                      <span className="text-xs">
                        {panelExpanded ? "Hide" : "Show"}
                      </span>
                    </Button>
                  ) : (
                    // Nothing to show until a selection exists, so the toggle
                    // is disabled rather than flipping a label with no panel
                    // behind it. A disabled button gets no pointer events, so
                    // the tooltip hangs off a wrapper.
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex w-full cursor-not-allowed max-md:w-16" />
                        }
                      >
                        <Button
                          variant="ghost"
                          size="rail"
                          disabled
                          aria-label={`Show panel. ${emptySelectionHint}`}
                          className="flex w-full flex-col items-center"
                        >
                          <PanelRightOpen className="size-4" />
                          <span className="text-xs">Show</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        {emptySelectionHint}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-1.5 py-2 max-md:min-w-0 max-md:overflow-x-auto max-md:overflow-y-hidden">
                  {actionBar}
                </div>
              </div>
            </aside>
          )}
        </ResizablePanel>
        {hasSidePanel && panelExpanded && (
          <>
            <ResizableHandle withHandle className="max-md:hidden" />
            <ResizablePanel
              id={detailPanelId}
              defaultSize={detailSizes.defaultSize}
              minSize={detailSizes.minSize}
              maxSize={detailSizes.maxSize}
              className="relative min-h-0 overflow-hidden"
            >
              {/* The library writes `overflow: auto` inline on the panel's
                 inner div, so a shadow above the top edge would be
                 clipped; hence none here. */}
              <div className="absolute inset-0 flex flex-col overflow-hidden border-t max-md:overflow-auto max-md:bg-background">
                {sidePanel}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
