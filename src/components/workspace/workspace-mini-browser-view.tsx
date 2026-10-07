"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { normalizePath } from "@/lib/services/workspace/mini-browser-items";
import { cn } from "@/lib/utils";
import { WorkspaceMiniBrowserTable } from "./workspace-mini-browser-table";

export interface WorkspaceMiniBrowserViewProps {
  items: WorkspaceItem[];
  isLoading: boolean;
  error: Error | null;
  selectedPath: string | null;
  /** Label of the parent row; `null` hides the row. */
  parentRowLabel: string | null;
  onParentClick: () => void;
  /** Rows a double click or Enter opens. */
  isItemNavigable: (item: WorkspaceItem) => boolean;
  /** Rows a click or arrow key selects. */
  isItemSelectable: (item: WorkspaceItem) => boolean;
  onNavigate: (item: WorkspaceItem) => void;
  onSelect: (item: WorkspaceItem) => void;
  /** Double click or Enter on a selectable row that does not navigate. */
  onCommit?: (item: WorkspaceItem) => void;
  ariaLabel?: string;
  emptyMessage?: string;
  className?: string;
}

/**
 * Controlled workspace listing with keyboard navigation. The caller owns the
 * location and the selection; this component owns only the focused row.
 * `WorkspaceMiniBrowser` wraps it with path-based navigation.
 */
export function WorkspaceMiniBrowserView({
  items,
  isLoading,
  error,
  selectedPath,
  parentRowLabel,
  onParentClick,
  isItemNavigable,
  isItemSelectable,
  onNavigate,
  onSelect,
  onCommit,
  ariaLabel = "Workspace destination browser",
  emptyMessage,
  className,
}: WorkspaceMiniBrowserViewProps) {
  const [focusedRow, setFocusedRow] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const showParentRow = parentRowLabel !== null;
  const selectedKey = selectedPath != null ? normalizePath(selectedPath) : null;
  const findItem = (key: string | null) =>
    key === null
      ? undefined
      : items.find((item) => normalizePath(item.path) === key);
  const targetItems = items.filter(
    (item) => isItemNavigable(item) || isItemSelectable(item),
  );
  const navigationTargets = [
    ...(showParentRow ? ["parent"] : []),
    ...targetItems.map((item) => normalizePath(item.path)),
  ];
  const selectedItem = findItem(selectedKey);
  const highlightedKey =
    focusedRow ??
    (selectedItem && isItemSelectable(selectedItem) ? selectedKey : null);

  const navigate = (item: WorkspaceItem) => {
    setFocusedRow(null);
    onNavigate(item);
  };

  const goToParent = () => {
    setFocusedRow(null);
    onParentClick();
  };

  const open = (item: WorkspaceItem): boolean => {
    if (isItemNavigable(item)) {
      navigate(item);
      return true;
    }
    if (onCommit && isItemSelectable(item)) {
      onCommit(item);
      return true;
    }
    return false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      if (focusedRow === "parent") {
        if (!showParentRow) return;
        event.preventDefault();
        goToParent();
        return;
      }
      const item = findItem(focusedRow ?? selectedKey);
      if (item && open(item)) event.preventDefault();
      return;
    }
    if (
      (event.key !== "ArrowDown" && event.key !== "ArrowUp") ||
      navigationTargets.length === 0
    ) {
      return;
    }

    const currentKey =
      focusedRow ?? selectedKey ?? (showParentRow ? "parent" : null);
    const currentIndex = currentKey
      ? navigationTargets.indexOf(currentKey)
      : -1;
    let nextIndex: number;
    if (event.shiftKey) {
      nextIndex = event.key === "ArrowDown" ? navigationTargets.length - 1 : 0;
    } else if (event.key === "ArrowDown") {
      nextIndex =
        currentIndex < 0
          ? 0
          : Math.min(currentIndex + 1, navigationTargets.length - 1);
    } else {
      nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
    }

    event.preventDefault();
    const nextKey = navigationTargets[nextIndex];
    setFocusedRow(nextKey);
    const nextItem = findItem(nextKey);
    if (nextItem && isItemSelectable(nextItem)) onSelect(nextItem);
  };

  useEffect(() => {
    const key = focusedRow ?? selectedKey;
    if (!key || !tableContainerRef.current) return;
    const row = tableContainerRef.current.querySelector<HTMLElement>(
      `[data-row-key="${CSS.escape(key)}"]`,
    );
    if (!row) return;
    const id = requestAnimationFrame(() => {
      row.scrollIntoView({ block: "center", inline: "start" });
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [focusedRow, selectedKey]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <WorkspaceMiniBrowserTable
        containerRef={tableContainerRef}
        items={items}
        isLoading={isLoading}
        error={error}
        highlightedKey={highlightedKey}
        parentRowLabel={parentRowLabel}
        ariaLabel={ariaLabel}
        emptyMessage={emptyMessage}
        onKeyDown={handleKeyDown}
        onParentClick={goToParent}
        onItemClick={(item) => {
          if (!isItemSelectable(item)) return;
          setFocusedRow(normalizePath(item.path));
          onSelect(item);
        }}
        onItemDoubleClick={(item) => {
          open(item);
        }}
      />
    </div>
  );
}
