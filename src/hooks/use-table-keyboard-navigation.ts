"use client";

import { useState, useCallback } from "react";
import type React from "react";

export interface UseTableKeyboardNavigationOptions<T> {
  items: T[];
  /** Return the index of the currently focused item, or -1 if none. */
  getFocusedIndex: () => number;
  /** Called when arrow keys move focus to an item. */
  onSelect: (
    item: T,
    modifiers: { ctrlOrMeta: boolean; shift: boolean },
  ) => void;
  /** Called when Enter is pressed on a focused item. */
  onEnter: (item: T) => void;
  /** Whether keyboard navigation is active. Defaults to true. */
  enabled?: boolean;
  /** Number of special leading rows before data items (e.g. "View shared" row). */
  leadingOffset?: number;
  /** Number of special parent rows before data items (e.g. "Parent folder" row). */
  parentOffset?: number;
  /** Called when Enter is pressed on the leading special row. */
  onLeadingEnter?: () => void;
  /** Called when Enter is pressed on the parent special row. */
  onParentEnter?: () => void;
  /** Called when focus moves to a special row (clears item selection). */
  onClearSelection?: () => void;
}

export function useTableKeyboardNavigation<T>({
  items,
  getFocusedIndex,
  onSelect,
  onEnter,
  enabled = true,
  leadingOffset = 0,
  parentOffset = 0,
  onLeadingEnter,
  onParentEnter,
  onClearSelection,
}: UseTableKeyboardNavigationOptions<T>) {
  const [rawFocusedSpecialRow, setFocusedSpecialRow] = useState<
    "leading" | "parent" | null
  >(null);

  const hasSpecialRows = leadingOffset > 0 || parentOffset > 0;

  // Special-row focus is only relevant when no item is focused
  const focusedSpecialRow =
    hasSpecialRows && getFocusedIndex() < 0 ? rawFocusedSpecialRow : null;

  const virtualRowCount = leadingOffset + parentOffset + items.length;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled) return;
      if (virtualRowCount === 0) return;

      const currentItemIndex = getFocusedIndex();

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
        if (focusedSpecialRow === "leading" && onLeadingEnter) {
          e.preventDefault();
          onLeadingEnter();
          return;
        }
        if (focusedSpecialRow === "parent" && onParentEnter) {
          e.preventDefault();
          onParentEnter();
          return;
        }
        const focusedItem =
          currentItemIndex >= 0 ? items[currentItemIndex] : null;
        if (focusedItem) {
          e.preventDefault();
          onEnter(focusedItem);
        }
        return;
      }

      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      e.preventDefault();

      let nextVirtual: number;
      let isJump = false;
      if (e.shiftKey) {
        nextVirtual =
          e.key === "ArrowDown" ? virtualRowCount - 1 : 0;
        isJump = true;
      } else if (e.key === "ArrowDown") {
        nextVirtual =
          currentVirtual < 0
            ? 0
            : Math.min(currentVirtual + 1, virtualRowCount - 1);
      } else {
        nextVirtual =
          currentVirtual <= 0 ? 0 : currentVirtual - 1;
      }

      // Check if landing on a special row
      if (hasSpecialRows) {
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
      }

      const nextItemIndex = nextVirtual - leadingOffset - parentOffset;
      const nextItem = items[nextItemIndex];
      if (nextItem != null) {
        if (hasSpecialRows) setFocusedSpecialRow(null);
        onSelect(nextItem, {
          ctrlOrMeta: isJump ? false : e.metaKey || e.ctrlKey,
          shift: false,
        });
      }
    },
    [
      enabled,
      virtualRowCount,
      leadingOffset,
      parentOffset,
      hasSpecialRows,
      items,
      getFocusedIndex,
      focusedSpecialRow,
      onSelect,
      onEnter,
      onLeadingEnter,
      onParentEnter,
      onClearSelection,
    ],
  );

  return {
    focusedSpecialRow,
    handleKeyDown,
  };
}
