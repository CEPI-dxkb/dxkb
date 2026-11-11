"use client";

import { useState } from "react";
import type React from "react";

export interface UseTableKeyboardNavigationOptions<T> {
  items: T[];
  getFocusedIndex: () => number;
  onSelect: (
    item: T,
    modifiers: { ctrlOrMeta: boolean; shift: boolean },
  ) => void;
  onEnter: (item: T) => void;
  enabled?: boolean;
  leadingOffset?: number;
  parentOffset?: number;
  onLeadingEnter?: () => void;
  onParentEnter?: () => void;
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

  const focusedSpecialRow =
    hasSpecialRows && getFocusedIndex() < 0 ? rawFocusedSpecialRow : null;

  const virtualRowCount = leadingOffset + parentOffset + items.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      nextVirtual = e.key === "ArrowDown" ? virtualRowCount - 1 : 0;
      isJump = true;
    } else if (e.key === "ArrowDown") {
      nextVirtual =
        currentVirtual < 0
          ? 0
          : Math.min(currentVirtual + 1, virtualRowCount - 1);
    } else {
      nextVirtual = currentVirtual <= 0 ? 0 : currentVirtual - 1;
    }

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
  };

  return {
    focusedSpecialRow,
    handleKeyDown,
  };
}
