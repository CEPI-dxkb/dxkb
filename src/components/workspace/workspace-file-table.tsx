"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { useRouter } from "next/navigation";
import type {
  WorkspaceSortConfig,
  WorkspaceViewMode,
} from "@/types/workspace-browser";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { noop } from "@/lib/utils";
import {
  parsePathSegments,
  workspaceItemDestination,
  workspaceParentDestination,
  workspaceRootDestination,
} from "@/lib/services/workspace/path-utils";
import { normalizePath } from "@/lib/workspace/table-selection";
import { isFolderType } from "@/lib/services/workspace/utils";
import { useTableKeyboardNavigation } from "@/hooks/use-table-keyboard-navigation";
import { useWorkspaceColumns } from "./workspace-table-columns";
import {
  LeadingRow,
  ParentRow,
  DataRow,
  EmptyRow,
} from "./workspace-table-rows";
import {
  DataTable,
  type DataTableHandle,
  useDataTableBody,
} from "@/components/shared/file-table";

const defaultColumnOrder = [
  "name",
  "size",
  "ownerId",
  "createdAt",
  "members",
  "type",
];

interface WorkspaceDataTableProps {
  items: WorkspaceItem[];
  isLoading: boolean;
  path: string;
  sort: WorkspaceSortConfig;
  onSortChange: (sort: WorkspaceSortConfig) => void;
  viewMode?: WorkspaceViewMode;
  memberCountByPath?: Record<string, number>;
  username?: string;
  sharedRootUsername?: string;
  favoritePaths?: string[];
  selectedPaths?: string[];
  onSelect?: (
    item: WorkspaceItem,
    modifiers?: { ctrlOrMeta: boolean; shift: boolean },
  ) => void;
  onItemDoubleClick?: (item: WorkspaceItem) => void;
  onClearSelection?: () => void;
}

export type WorkspaceDataTableHandle = DataTableHandle;

interface WorkspaceTableBodyProps {
  showLeadingRow: boolean;
  showParentRow: boolean;
  useSelectionMode: boolean;
  focusedSpecialRow: "leading" | "parent" | null;
  parentRowLabel: string;
  selectedPathSet: Set<string>;
  onLeadingClick: () => void;
  onParentClick: () => void;
  onSelect?: WorkspaceDataTableProps["onSelect"];
  onItemClick: (item: WorkspaceItem) => void;
  onItemDoubleClick?: (item: WorkspaceItem) => void;
}

function WorkspaceTableBody({
  showLeadingRow,
  showParentRow,
  useSelectionMode,
  focusedSpecialRow,
  parentRowLabel,
  selectedPathSet,
  onLeadingClick,
  onParentClick,
  onSelect,
  onItemClick,
  onItemDoubleClick,
}: WorkspaceTableBodyProps) {
  const { rows, columnOrder, colSpan } = useDataTableBody<WorkspaceItem>();

  return (
    <>
      {showLeadingRow && (
        <LeadingRow
          useSelectionMode={useSelectionMode}
          isFocused={false}
          onClick={onLeadingClick}
          label="View All Workspaces"
          columnOrder={columnOrder}
        />
      )}
      {showParentRow && (
        <ParentRow
          useSelectionMode={useSelectionMode}
          isFocused={focusedSpecialRow === "parent"}
          onClick={onParentClick}
          label={parentRowLabel}
          columnOrder={columnOrder}
        />
      )}
      {rows.length === 0 ? (
        <EmptyRow colSpan={colSpan} />
      ) : (
        rows.map((row) => (
          <DataRow
            key={row.id}
            row={row}
            useSelectionMode={useSelectionMode}
            isSelected={selectedPathSet.has(normalizePath(row.original.path))}
            onSelect={onSelect}
            onItemClick={onItemClick}
            onItemDoubleClick={onItemDoubleClick}
          />
        ))
      )}
    </>
  );
}

export const WorkspaceDataTable = forwardRef<
  WorkspaceDataTableHandle,
  WorkspaceDataTableProps
>(function WorkspaceDataTable(
  {
    items,
    isLoading,
    path,
    sort,
    onSortChange,
    viewMode = "home",
    memberCountByPath,
    username = "",
    sharedRootUsername,
    favoritePaths,
    selectedPaths = [],
    onSelect,
    onItemDoubleClick,
    onClearSelection,
  },
  ref,
) {
  const useSelectionMode = onSelect != null;
  if (useSelectionMode && onItemDoubleClick == null) {
    throw new Error(
      "WorkspaceDataTable selection mode requires onItemDoubleClick so folders remain navigable",
    );
  }
  const router = useRouter();
  const dataTableRef = useRef<DataTableHandle>(null);
  const isAtRoot = !path || path === "" || path === "/";

  useImperativeHandle(ref, () => ({
    focus: () => dataTableRef.current?.focus(),
  }));

  const pathSegments = parsePathSegments(path);
  const selectedPathSet = new Set(selectedPaths.map(normalizePath));
  const navigation = {
    mode: viewMode,
    path,
    username,
    sharedRootUsername,
  };

  const handleItemClick = (item: WorkspaceItem) => {
    if (!isFolderType(item.type)) return;
    router.push(workspaceItemDestination(navigation, item));
  };

  const handleParentClick = () => {
    router.push(workspaceParentDestination(navigation));
  };

  const showLeadingRow = viewMode === "home" && isAtRoot;
  const handleLeadingClick = () => {
    router.push(workspaceRootDestination(username));
  };

  const showParentRow =
    viewMode === "shared" || viewMode === "public"
      ? pathSegments.length >= 1
      : !isAtRoot;
  const parentRowLabel =
    viewMode === "public"
      ? pathSegments.length <= 2
        ? "Back to public workspaces"
        : "Parent folder"
      : viewMode === "shared"
        ? pathSegments.length <= 2
          ? "Back to my workspaces"
          : "Parent folder"
        : "Parent folder";
  const parentOffset = showParentRow ? 1 : 0;

  const getFocusedIndex = () => {
    if (selectedPaths.length === 0) return -1;
    const normalizedFocus = normalizePath(
      selectedPaths[selectedPaths.length - 1],
    );
    return items.findIndex((i) => normalizePath(i.path) === normalizedFocus);
  };

  const handleEnter = (item: WorkspaceItem) => {
    if (isFolderType(item.type)) {
      onItemDoubleClick?.(item);
    }
  };

  const { focusedSpecialRow, handleKeyDown } =
    useTableKeyboardNavigation<WorkspaceItem>({
      items,
      getFocusedIndex,
      onSelect: onSelect ?? noop,
      onEnter: handleEnter,
      enabled: useSelectionMode,
      leadingOffset: 0,
      parentOffset,
      onParentEnter: handleParentClick,
      onClearSelection,
    });

  const { columns, handleSort } = useWorkspaceColumns(
    sort,
    onSortChange,
    memberCountByPath,
    favoritePaths,
  );

  return (
    <DataTable<WorkspaceItem>
      ref={dataTableRef}
      data={items}
      columns={columns}
      defaultColumnOrder={defaultColumnOrder}
      isLoading={isLoading}
      getRowId={(row) => row.id}
      sort={{ field: sort.field, direction: sort.direction }}
      onSort={handleSort}
      dndId="workspace-table-dnd"
      onKeyDown={handleKeyDown}
      ariaLabel="Workspace items"
      tabIndex={useSelectionMode ? 0 : undefined}
    >
      <WorkspaceTableBody
        showLeadingRow={showLeadingRow}
        showParentRow={showParentRow}
        useSelectionMode={useSelectionMode}
        focusedSpecialRow={focusedSpecialRow}
        parentRowLabel={parentRowLabel}
        selectedPathSet={selectedPathSet}
        onLeadingClick={handleLeadingClick}
        onParentClick={handleParentClick}
        onSelect={onSelect}
        onItemClick={handleItemClick}
        onItemDoubleClick={onItemDoubleClick}
      />
    </DataTable>
  );
});
