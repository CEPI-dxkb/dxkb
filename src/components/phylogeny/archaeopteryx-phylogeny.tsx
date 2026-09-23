"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  createViewerConfig,
  documentViewerTheme,
  loadArchaeopteryx,
  mountArchaeopteryx,
  seedViewerTheme,
  setViewerControlsCollapsed,
  syncViewerTheme,
  type ArchaeopteryxNode,
} from "@/lib/phylogeny/archaeopteryx";

import { ArchaeopteryxLoading } from "./archaeopteryx-loading";

// In a host this narrow the floating control panel would cover most of the
// tree, so it is kept collapsed to its header bar. The host, not the viewport,
// is measured: the side panel can take most of a wide screen.
const collapsedControlsWidth = 640;

function subscribeSelectionChange(listener: () => void): () => void {
  document.addEventListener("selected_nodes_changed_event", listener);
  return () => {
    document.removeEventListener("selected_nodes_changed_event", listener);
  };
}

interface ArchaeopteryxPhylogenyProps {
  xml: string;
  title: string;
  selectable?: boolean;
  onSelect?: (node: ArchaeopteryxNode | null) => void;
}

export function ArchaeopteryxPhylogeny({
  xml,
  title,
  selectable = false,
  onSelect,
}: ArchaeopteryxPhylogenyProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string | null | undefined>(undefined);
  const handleSelect = useEffectEvent((node: ArchaeopteryxNode | null) => {
    onSelect?.(node);
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    // A function, so each check after an await reads the current value.
    const isCancelled = () => cancelled;
    let tornDown = false;
    let destroyRenderer: (() => void) | null = null;
    let getSelectedNodes: () => ArchaeopteryxNode[] = () => [];
    let resizeFrame: number | null = null;
    let removeSelectionListener: () => void = () => undefined;
    const isNarrowHost = () => host.clientWidth <= collapsedControlsWidth;
    let narrowHost = false;
    let controlsCollapsedForWidth = false;
    // Only crossing the threshold moves the controls, and widening reopens
    // them only if narrowing folded them, so a choice the user makes in
    // between stands.
    const fitControlsToHost = () => {
      const narrow = isNarrowHost();
      if (narrow === narrowHost) return;
      narrowHost = narrow;
      if (narrow) {
        controlsCollapsedForWidth = setViewerControlsCollapsed(host, true);
      } else if (controlsCollapsedForWidth) {
        controlsCollapsedForWidth = false;
        setViewerControlsCollapsed(host, false);
      }
    };
    // Archaeopteryx follows window resizes only; the host also resizes when
    // the side panel opens or its separator is dragged.
    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        fitControlsToHost();
        window.dispatchEvent(new Event("resize"));
      });
    });

    const teardown = () => {
      if (tornDown) return;
      tornDown = true;
      resizeObserver.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      removeSelectionListener();
      destroyRenderer?.();
    };

    const render = async () => {
      setStatus(undefined);
      host.replaceChildren();

      const archaeopteryx = await loadArchaeopteryx();
      if (isCancelled()) return;

      const tree = archaeopteryx.parsePhyloXML(xml);
      narrowHost = isNarrowHost();
      controlsCollapsedForWidth = narrowHost;
      const config = createViewerConfig(tree, {
        selectable,
        collapseControlPanel: narrowHost,
      });
      seedViewerTheme(documentViewerTheme());
      const viewer = mountArchaeopteryx(archaeopteryx, host, tree, config);
      destroyRenderer = viewer.destroy;
      getSelectedNodes = viewer.getSelectedNodes;
      await viewer.ready;
      if (isCancelled()) return;

      // The theme may have changed while the tree was being drawn.
      syncViewerTheme(host, documentViewerTheme());
      resizeObserver.observe(host);
      setStatus(null);
    };

    const selectionChanged = () => {
      const node = getSelectedNodes().at(-1);
      handleSelect(node && !node.children?.length ? node : null);
    };

    if (selectable) {
      removeSelectionListener = subscribeSelectionChange(selectionChanged);
    }
    void render().catch((cause: unknown) => {
      if (!cancelled) {
        teardown();
        setStatus(
          cause instanceof Error
            ? cause.message
            : "The tree could not be rendered.",
        );
      }
    });

    return () => {
      cancelled = true;
      teardown();
    };
  }, [selectable, xml]);

  useEffect(() => {
    let themeFrame: number | null = null;
    const updateTheme = () => {
      if (themeFrame !== null) cancelAnimationFrame(themeFrame);
      themeFrame = requestAnimationFrame(() => {
        const host = hostRef.current;
        if (host) syncViewerTheme(host, documentViewerTheme());
      });
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      observer.disconnect();
      if (themeFrame !== null) cancelAnimationFrame(themeFrame);
    };
  }, []);

  if (status) {
    return (
      <div className="grid h-full min-h-64 place-items-center p-6 text-center">
        <div>
          <h2 className="font-semibold text-destructive">
            Phylogeny renderer unavailable
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{status}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="archaeopteryx-dxkb relative h-full min-h-0 overflow-hidden bg-background">
      {status === undefined && (
        <div className="absolute inset-0 z-10 bg-background">
          <ArchaeopteryxLoading />
        </div>
      )}
      {/* No minimum height: Archaeopteryx sizes its canvas to this box, and
          the page region around it never scrolls, so any extra height is cut
          off. A short frame gets a short canvas the viewer pans and zooms. */}
      <div
        ref={hostRef}
        className="size-full min-w-0"
        role="group"
        aria-label={`Interactive phylogenetic tree for ${title}`}
      />
    </div>
  );
}
