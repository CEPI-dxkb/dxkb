"use client";

import type { ReactNode, RefObject } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";
import type {
  WorkspaceSortConfig,
  WorkspaceViewMode,
} from "@/types/workspace-browser";
import { JobMetadataCard } from "./job-metadata-card";
import { WorkspaceBreadcrumbs } from "./workspace-breadcrumbs";
import {
  WorkspaceDataTable,
  type WorkspaceDataTableHandle,
} from "./workspace-file-table";
import { WorkspaceShell } from "./workspace-shell";
import { WorkspaceToolbar } from "./workspace-toolbar";

export function WorkspaceBrowserLoading({
  path,
  username,
  viewMode,
}: {
  path: string;
  username: string;
  viewMode: "home" | "shared";
}) {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] w-full flex-col overflow-hidden">
      <div className="min-w-0 shrink-0 space-y-4 overflow-hidden p-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="min-h-0 flex-1">
        <WorkspaceDataTable
          items={[]}
          isLoading={true}
          path={path}
          sort={{ field: "name", direction: "asc" }}
          onSortChange={() => undefined}
          viewMode={viewMode}
          username={username}
        />
      </div>
    </div>
  );
}

interface WorkspaceBrowserPresentationProps {
  selectedItems: WorkspaceItem[];
  actionBar: ReactNode;
  dialogs: ReactNode;
  notFoundDialog: ReactNode;
  path: string;
  username: string;
  itemCount: number;
  currentUsername: string;
  workspaceRootUsername?: string;
  toolbar: {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    typeFilter: string;
    onTypeFilterChange: (type: string) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    showHiddenFiles: boolean;
    onShowHiddenFilesChange: (show: boolean) => void;
    onNewFolder?: () => void;
    onUpload?: () => void;
    onNewWorkspace?: () => void;
  };
  enabled: boolean;
  error: Error | null;
  view:
    | { kind: "home" }
    | { kind: "shared"; atRoot: boolean }
    | { kind: "public" }
    | {
        kind: "jobResult";
        source: "home" | "shared";
        resolvedJobMeta: ResolvedPathObject | null;
      };
  tableRef: RefObject<WorkspaceDataTableHandle | null>;
  items: WorkspaceItem[];
  isLoading: boolean;
  sort: WorkspaceSortConfig;
  onSortChange: (sort: WorkspaceSortConfig) => void;
  sharedRootUsername?: string;
  memberCountByPath?: Record<string, number>;
  favoritePaths?: string[];
  selectedPaths: string[];
  onSelect: (
    item: WorkspaceItem,
    modifiers?: { ctrlOrMeta: boolean; shift: boolean },
  ) => void;
  onItemDoubleClick: (item: WorkspaceItem) => void;
  onClearSelection: () => void;
}

export function WorkspaceBrowserPresentation({
  selectedItems,
  actionBar,
  dialogs,
  notFoundDialog,
  path,
  username,
  itemCount,
  currentUsername,
  workspaceRootUsername,
  toolbar,
  enabled,
  error,
  view,
  tableRef,
  items,
  isLoading,
  sort,
  onSortChange,
  sharedRootUsername,
  memberCountByPath,
  favoritePaths,
  selectedPaths,
  onSelect,
  onItemDoubleClick,
  onClearSelection,
}: WorkspaceBrowserPresentationProps) {
  const isJobResultView = view.kind === "jobResult";
  const breadcrumbMode =
    view.kind === "jobResult"
      ? view.source
      : view.kind === "shared" && view.atRoot
        ? "root"
        : view.kind;
  const tableViewMode: WorkspaceViewMode =
    view.kind === "jobResult" ? view.source : view.kind;

  const table = (
    <WorkspaceDataTable
      ref={tableRef}
      items={items}
      isLoading={isLoading}
      path={path}
      sort={sort}
      onSortChange={onSortChange}
      viewMode={tableViewMode}
      username={username}
      sharedRootUsername={sharedRootUsername}
      memberCountByPath={isJobResultView ? undefined : memberCountByPath}
      favoritePaths={isJobResultView ? undefined : favoritePaths}
      selectedPaths={selectedPaths}
      onSelect={onSelect}
      onItemDoubleClick={onItemDoubleClick}
      onClearSelection={onClearSelection}
    />
  );

  return (
    <WorkspaceShell selectedItems={selectedItems} actionBar={actionBar}>
      {dialogs}
      <div className="@container min-w-0 shrink-0 space-y-4 overflow-hidden p-4">
        <WorkspaceBreadcrumbs
          path={path}
          username={username}
          itemCount={itemCount}
          viewMode={breadcrumbMode}
          currentUsername={currentUsername}
          workspaceRootUsername={workspaceRootUsername}
        />
        <WorkspaceToolbar
          searchQuery={toolbar.searchQuery}
          onSearchChange={toolbar.onSearchChange}
          typeFilter={toolbar.typeFilter}
          onTypeFilterChange={toolbar.onTypeFilterChange}
          onRefresh={toolbar.onRefresh}
          isRefreshing={toolbar.isRefreshing}
          showHiddenFiles={toolbar.showHiddenFiles}
          onShowHiddenFilesChange={toolbar.onShowHiddenFilesChange}
          onNewFolder={toolbar.onNewFolder}
          onUpload={toolbar.onUpload}
          isAtRoot={view.kind === "shared" && view.atRoot}
          onNewWorkspace={toolbar.onNewWorkspace}
        />
        {enabled && error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              {view.kind === "public"
                ? "Failed to load public workspaces"
                : view.kind === "home"
                  ? "Failed to load workspace contents"
                  : "Failed to load shared folders"}
              : {error.message}
            </AlertDescription>
          </Alert>
        )}
      </div>
      {isJobResultView ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden border-border pb-4">
          <div className="px-4">
            {view.resolvedJobMeta && (
              <JobMetadataCard
                resolvedJobMeta={view.resolvedJobMeta}
                className="px-4"
              />
            )}
          </div>
          <div className="min-h-0 flex-1">{table}</div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">{table}</div>
      )}
      {notFoundDialog}
    </WorkspaceShell>
  );
}
