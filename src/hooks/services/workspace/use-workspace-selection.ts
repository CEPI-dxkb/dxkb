"use client";

import { useState, useCallback, useMemo } from "react";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import {
  computeNextSelection,
  normalizePath,
  type SelectionModifiers,
} from "@/lib/workspace/table-selection";

export interface UseWorkspaceSelectionOptions {
  processedItems: WorkspaceBrowserItem[];
  panelManuallyHidden: boolean;
  setPanelExpanded: (v: boolean) => void;
}

export function useWorkspaceSelection({
  processedItems,
  panelManuallyHidden,
  setPanelExpanded,
}: UseWorkspaceSelectionOptions) {
  const [selectedItems, setSelectedItems] = useState<WorkspaceBrowserItem[]>([]);
  const [anchorPath, setAnchorPath] = useState<string | null>(null);

  const selectedPaths = useMemo(
    () => selectedItems.map((i) => normalizePath(i.path)),
    [selectedItems],
  );

  const primaryItem = selectedItems[selectedItems.length - 1] ?? null;

  const handleSelectItem = useCallback(
    (item: WorkspaceBrowserItem, modifiers?: SelectionModifiers) => {
      const { nextSelection, nextAnchorPath } = computeNextSelection(
        processedItems,
        selectedItems,
        anchorPath,
        item,
        modifiers ?? { ctrlOrMeta: false, shift: false },
      );
      setSelectedItems(nextSelection);
      setAnchorPath(nextAnchorPath);
      if (!panelManuallyHidden) setPanelExpanded(true);
    },
    [processedItems, selectedItems, anchorPath, panelManuallyHidden, setPanelExpanded],
  );

  const clearSelection = useCallback(() => {
    setSelectedItems([]);
    setAnchorPath(null);
  }, []);

  return {
    selectedItems,
    anchorPath,
    selectedPaths,
    primaryItem,
    handleSelectItem,
    clearSelection,
  };
}
