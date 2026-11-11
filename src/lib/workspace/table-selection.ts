import type { WorkspaceItem } from "@/lib/services/workspace/domain";

export function normalizePath(p: string | undefined): string {
  return (p ?? "").replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "") || "/";
}

export interface SelectionModifiers {
  ctrlOrMeta: boolean;
  shift: boolean;
}

export interface SelectionResult {
  nextSelection: WorkspaceItem[];
  nextAnchorPath: string | null;
}

export function computeNextSelection(
  orderedItems: WorkspaceItem[],
  currentSelection: WorkspaceItem[],
  anchorPath: string | null,
  clickedItem: WorkspaceItem,
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
    let nextSelection: WorkspaceItem[];
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

  const anchorIndex = orderedItems.findIndex(
    (i) => normalizePath(i.path) === normalizePath(anchorPath ?? ""),
  );
  const clickedIndex = orderedItems.findIndex(
    (i) => normalizePath(i.path) === clickedPath,
  );

  if (anchorIndex < 0 || clickedIndex < 0) {
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
