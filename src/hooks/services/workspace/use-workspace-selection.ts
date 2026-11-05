"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { isFolderType } from "@/lib/services/workspace/utils";
import {
  computeNextSelection,
  normalizePath,
  type SelectionModifiers,
} from "@/lib/workspace/table-selection";

export interface UseWorkspaceSelectionOptions {
  processedItems: WorkspaceItem[];
  panelManuallyHidden: boolean;
  setPanelExpanded: (v: boolean) => void;
}

export interface UseWorkspaceSelectionReturn {
  selectedItems: WorkspaceItem[];
  anchorPath: string | null;
  selectedPaths: string[];
  /** Last selected item, or null when nothing is selected. */
  primaryItem: WorkspaceItem | null;
  handleSelectItem: (
    item: WorkspaceItem,
    modifiers?: SelectionModifiers,
  ) => void;
  clearSelection: () => void;
}

export function useWorkspaceSelection({
  processedItems,
  panelManuallyHidden,
  setPanelExpanded,
}: UseWorkspaceSelectionOptions): UseWorkspaceSelectionReturn {
  const [selectedItems, setSelectedItems] = useState<WorkspaceItem[]>([]);
  const [anchorPath, setAnchorPath] = useState<string | null>(null);
  const panelExpansionTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (panelExpansionTimer.current)
        clearTimeout(panelExpansionTimer.current);
    };
  }, []);

  useEffect(() => {
    if (panelManuallyHidden && panelExpansionTimer.current) {
      clearTimeout(panelExpansionTimer.current);
      panelExpansionTimer.current = null;
    }
  }, [panelManuallyHidden]);

  const itemByPath = new Map(
    processedItems.map((item) => [normalizePath(item.path), item]),
  );
  const refreshedItems = selectedItems.map(
    (item) => itemByPath.get(normalizePath(item.path)) ?? item,
  );
  const currentSelectedItems = refreshedItems.every(
    (item, index) => item === selectedItems[index],
  )
    ? selectedItems
    : refreshedItems;

  const selectedPaths = currentSelectedItems.map((item) =>
    normalizePath(item.path),
  );

  const primaryItem: WorkspaceItem | null =
    currentSelectedItems[currentSelectedItems.length - 1] ?? null;

  const selectItem = (
    item: WorkspaceItem,
    modifiers?: SelectionModifiers,
  ) => {
    const { nextSelection, nextAnchorPath } = computeNextSelection(
      processedItems,
      selectedItems,
      anchorPath,
      item,
      modifiers ?? { ctrlOrMeta: false, shift: false },
    );
    setSelectedItems(nextSelection);
    setAnchorPath(nextAnchorPath);
    if (!panelManuallyHidden) {
      if (panelExpansionTimer.current)
        clearTimeout(panelExpansionTimer.current);
      if (isFolderType(item.type)) {
        panelExpansionTimer.current = setTimeout(() => {
          setPanelExpanded(true);
          panelExpansionTimer.current = null;
        }, 500);
      } else {
        panelExpansionTimer.current = null;
        setPanelExpanded(true);
      }
    }
  };

  // Rows memoize on this handler, so its identity must not change per selection.
  // The ref holds the latest closure; it is set in a layout effect, never during render
  // (a deferred-search commit does not flush passive effects before the next input).
  const selectItemRef = useRef(selectItem);
  useLayoutEffect(() => {
    selectItemRef.current = selectItem;
  });
  const handleSelectItem = useCallback(
    (item: WorkspaceItem, modifiers?: SelectionModifiers) => {
      selectItemRef.current(item, modifiers);
    },
    [],
  );

  // Explicit memo: `useWorkspaceNavigation`'s handlers depend on it, and rows
  // key their handlers on those, so it must stay stable without the compiler.
  const clearSelection = useCallback(() => {
    if (panelExpansionTimer.current) {
      clearTimeout(panelExpansionTimer.current);
      panelExpansionTimer.current = null;
    }
    setSelectedItems([]);
    setAnchorPath(null);
  }, []);

  return {
    selectedItems: currentSelectedItems,
    anchorPath,
    selectedPaths,
    primaryItem,
    handleSelectItem,
    clearSelection,
  };
}
