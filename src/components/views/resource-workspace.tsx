"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface ResourceWorkspaceProps {
  children: ReactNode;
  sidePanel: ReactNode;
  actionBar?: ReactNode;
  hasSidePanel?: boolean;
}

/**
 * Below this width the detail panel sits under the content instead of beside it.
 * Matches Tailwind's `md` breakpoint so the `max-md:` utilities below flip in the
 * same place as the `orientation`/`disabled`/size props this query feeds.
 */
const narrowWorkspaceQuery = "(max-width: 47.999rem)";

/**
 * Detail-panel extent along the group's main axis, per layout. Stacked gets a much
 * larger share because the axis is the viewport's short one, and it cannot be dragged
 * (the group is `disabled` and the separator is hidden below `md`), so its default is
 * also its final size.
 */
const detailPanelSizes = {
  stacked: { defaultSize: "45%", minSize: "25%", maxSize: "60%" },
  sideBySide: { defaultSize: "15%", minSize: "10%", maxSize: "60%" },
} as const;

/**
 * The content / action-strip / detail-panel shell every resource view fills.
 *
 * **One element tree, in both layouts.** `children`, `actionBar` and `sidePanel` are
 * each rendered exactly once, under the same ancestors at every width; crossing
 * `narrowWorkspaceQuery` only changes props and `max-md:` classes on that stable tree.
 * That matters because `children` is typically a whole resource collection, and React
 * cannot reconcile a subtree across two different ancestor element types — returning a
 * separate narrow tree discarded the table's selection, scroll and focus, the tree's
 * expansion state, and any dialog the action bar had open, on every resize. It also
 * double-mounted every narrow page load, because `isNarrow` can only become true after
 * the effect below has read `matchMedia`.
 *
 * The one thing the layout cannot express in CSS alone is the resize axis:
 * `ResizablePanelGroup` computes drag geometry in JS and writes the main-axis extent
 * as an inline style, so `orientation` has to come from a real media-query read. It is
 * a prop on a tree that stays put, not a choice of tree.
 *
 * Hiding the detail panel — either because the consumer withdrew it (`hasSidePanel`)
 * or because the user pressed Hide — still unmounts that slot. That is the panel's
 * intended lifecycle, not the responsive defect.
 */
export function ResourceWorkspace({
  children,
  sidePanel,
  actionBar,
  hasSidePanel = true,
}: ResourceWorkspaceProps) {
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
    : detailPanelSizes.sideBySide;

  return (
    <div
      // "stacked" below the md breakpoint, "resizable" above it. Read by tests to
      // tell the two responsive modes apart; both render the same element tree.
      data-layout={isNarrow ? "stacked" : "resizable"}
      className="flex min-h-0 w-full flex-1 overflow-hidden"
    >
      <ResizablePanelGroup
        orientation={isNarrow ? "vertical" : "horizontal"}
        // Stacked has no room to trade between content and detail, and the separator
        // is hidden there, so nothing should be draggable.
        disabled={isNarrow}
        className="size-full min-h-0"
      >
        <ResizablePanel
          minSize="20%"
          // Content beside the action strip when side by side, above it when stacked.
          className="flex min-h-0 min-w-0 overflow-hidden max-md:flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
          <aside className="shrink-0">
            <div className="flex h-full min-h-0 w-20 shrink-0 flex-col rounded-l-lg border-l bg-muted max-md:h-auto max-md:w-full max-md:flex-row max-md:rounded-l-none max-md:border-t max-md:border-l-0">
              <div className="border-b p-2 max-md:border-r max-md:border-b-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPanelExpanded((current) => !current);
                  }}
                  title={panelExpanded ? "Hide panel" : "Show panel"}
                  className="flex h-auto w-full flex-col items-center gap-0 px-1 py-2 max-md:w-16"
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
              </div>
              <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-1.5 py-2 max-md:flex">
                {actionBar}
              </div>
            </div>
          </aside>
        </ResizablePanel>
        {hasSidePanel && panelExpanded && (
          <>
            {/* Nothing to drag when stacked, so the separator goes out of the layout
                and out of the accessibility tree and tab order with it. */}
            <ResizableHandle withHandle className="max-md:hidden" />
            <ResizablePanel
              defaultSize={detailSizes.defaultSize}
              minSize={detailSizes.minSize}
              maxSize={detailSizes.maxSize}
              className="relative min-h-0 overflow-hidden"
            >
              <div className="absolute inset-0 flex flex-col overflow-hidden border-t max-md:overflow-auto max-md:shadow-[0_-8px_24px_-16px_rgb(0_0_0/0.5)]">
                {sidePanel}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
