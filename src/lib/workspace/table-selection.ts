import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

/**
 * Normalizes a path for consistent comparison in selection (matches table display order).
 */
export function normalizePath(p: string | undefined): string {
  return (p ?? "").replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "") || "/";
}

export interface SelectionModifiers {
  /** ctrlKey || metaKey (Mac Cmd) */
  ctrlOrMeta: boolean;
  shift: boolean;
}

export interface SelectionResult {
  nextSelection: WorkspaceBrowserItem[];
  nextAnchorPath: string | null;
}

/**
 * Computes the next selection and anchor from current state and click modifiers.
 * Used for normal click (replace), Ctrl/Cmd+click (toggle), and Shift+click (range).
 */
export function computeNextSelection(
  orderedItems: WorkspaceBrowserItem[],
  currentSelection: WorkspaceBrowserItem[],
  anchorPath: string | null,
  clickedItem: WorkspaceBrowserItem,
  modifiers: SelectionModifiers,
): SelectionResult {
  const clickedPath = normalizePath(clickedItem.path);

  if (!modifiers.ctrlOrMeta && !modifiers.shift) {
    return {
      nextSelection: [clickedItem],
      nextAnchorPath: clickedPath,
    };
  }

  if (modifiers.ctrlOrMeta) {
    const currentPaths = new Set(
      currentSelection.map((s) => normalizePath(s.path)),
    );
    const isSelected = currentPaths.has(clickedPath);
    let nextSelection: WorkspaceBrowserItem[];
    if (isSelected) {
      nextSelection = currentSelection.filter(
        (s) => normalizePath(s.path) !== clickedPath,
      );
    } else {
      nextSelection = [...currentSelection, clickedItem];
    }
    return {
      nextSelection,
      nextAnchorPath: anchorPath ?? clickedPath,
    };
  }

  // Shift+click: range from anchor to clicked
  const anchorIndex = orderedItems.findIndex(
    (i) => normalizePath(i.path) === normalizePath(anchorPath ?? ""),
  );
  const clickedIndex = orderedItems.findIndex(
    (i) => normalizePath(i.path) === clickedPath,
  );

  if (anchorIndex < 0 || clickedIndex < 0) {
    // Anchor not in list or clicked not in list: treat as single select
    return {
      nextSelection: [clickedItem],
      nextAnchorPath: clickedPath,
    };
  }

  const lo = Math.min(anchorIndex, clickedIndex);
  const hi = Math.max(anchorIndex, clickedIndex);
  const nextSelection = orderedItems.slice(lo, hi + 1);

  return {
    nextSelection,
    nextAnchorPath: anchorPath,
  };
}
