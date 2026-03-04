"use client";

import { useState, useCallback } from "react";
import type React from "react";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { normalizePath } from "@/lib/workspace/table-selection";
import { isFolderType } from "@/lib/services/workspace/utils";

export interface UseTableKeyboardNavigationOptions {
  useSelectionMode: boolean;
  items: WorkspaceBrowserItem[];
  selectedPaths: string[];
  leadingOffset: number;
  parentOffset: number;
  onSelect?: (
    item: WorkspaceBrowserItem,
    modifiers?: { ctrlOrMeta: boolean; shift: boolean },
  ) => void;
  onItemDoubleClick?: (item: WorkspaceBrowserItem) => void;
  onOpenFileRequested?: (item: WorkspaceBrowserItem) => void;
  onClearSelection?: () => void;
  sharedBase: string;
  router: { push: (url: string) => void };
  handleParentClick: () => void;
}

export function useTableKeyboardNavigation({
  useSelectionMode,
  items,
  selectedPaths,
  leadingOffset,
  parentOffset,
  onSelect,
  onItemDoubleClick,
  onOpenFileRequested,
  onClearSelection,
  sharedBase,
  router,
  handleParentClick,
}: UseTableKeyboardNavigationOptions) {
  const [rawFocusedSpecialRow, setFocusedSpecialRow] = useState<
    "leading" | "parent" | null
  >(null);

  // Special-row focus is only relevant when no items are selected
  const focusedSpecialRow =
    (selectedPaths ?? []).length > 0 ? null : rawFocusedSpecialRow;

  const virtualRowCount = leadingOffset + parentOffset + items.length;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!useSelectionMode) return;
      if (virtualRowCount === 0) return;

      const paths = selectedPaths ?? [];
      const focusPath = paths.length > 0 ? paths[paths.length - 1] : null;
      const normalizedFocus = normalizePath(focusPath ?? undefined);
      const currentItemIndex = items.findIndex(
        (i) => normalizePath(i.path) === normalizedFocus,
      );

      let currentVirtual: number;
      if (focusedSpecialRow === "leading") {
        currentVirtual = 0;
      } else if (focusedSpecialRow === "parent") {
        currentVirtual = leadingOffset;
      } else if (currentItemIndex >= 0) {
        currentVirtual = leadingOffset + parentOffset + currentItemIndex;
      } else {
        currentVirtual = -1;
      }

      if (e.key === "Enter") {
        if (focusedSpecialRow === "parent") {
          e.preventDefault();
          handleParentClick();
          return;
        }
        if (focusedSpecialRow === "leading") {
          e.preventDefault();
          router.push(sharedBase);
          return;
        }
        const focusedItem =
          currentItemIndex >= 0 ? items[currentItemIndex] : null;
        if (focusedItem) {
          e.preventDefault();
          if (!isFolderType(focusedItem.type)) {
            onOpenFileRequested?.(focusedItem);
          } else {
            onItemDoubleClick?.(focusedItem);
          }
        }
        return;
      }

      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      let nextVirtual: number;
      if (e.shiftKey) {
        nextVirtual =
          e.key === "ArrowDown" ? virtualRowCount - 1 : 0;
      } else if (e.key === "ArrowDown") {
        nextVirtual =
          currentVirtual < 0 ? 0 : Math.min(currentVirtual + 1, virtualRowCount - 1);
      } else {
        nextVirtual =
          currentVirtual <= 0 ? virtualRowCount - 1 : currentVirtual - 1;
      }

      e.preventDefault();

      if (nextVirtual < leadingOffset) {
        setFocusedSpecialRow("leading");
        onClearSelection?.();
        return;
      }
      if (nextVirtual < leadingOffset + parentOffset) {
        setFocusedSpecialRow("parent");
        onClearSelection?.();
        return;
      }
      const nextItemIndex = nextVirtual - leadingOffset - parentOffset;
      const nextItem = items[nextItemIndex];
      if (nextItem != null) {
        setFocusedSpecialRow(null);
        onSelect?.(nextItem, { ctrlOrMeta: e.metaKey || e.ctrlKey, shift: e.shiftKey });
      }
    },
    [
      useSelectionMode,
      virtualRowCount,
      leadingOffset,
      parentOffset,
      items,
      selectedPaths,
      focusedSpecialRow,
      onSelect,
      onItemDoubleClick,
      onOpenFileRequested,
      onClearSelection,
      sharedBase,
      router,
      handleParentClick,
    ],
  );

  return {
    focusedSpecialRow,
    handleKeyDown,
  };
}
