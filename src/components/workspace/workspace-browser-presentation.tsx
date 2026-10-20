"use client";

import type { ReactNode, RefObject } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";
import { workspaceErrorMessage } from "@/lib/services/workspace/workspace-errors";
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
  sort,
}: {
  path: string;
  username: string;
  viewMode: "home" | "shared";
  /** The saved sort, so the skeleton header matches the table that replaces it. */
  sort: WorkspaceSortConfig;
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
          sort={sort}
          onSortChange={() => undefined}
          viewMode={viewMode}
          username={username}
        />
      </div>
    </div>
  );
}

type WorkspaceBrowserView = WorkspaceBrowserPresentationProps["view"];

/** Names what failed by where the user is, not by which view mode is showing it. */
function loadErrorTitle(view: WorkspaceBrowserView, path: string): string {
  const atRoot = path.split("/").filter(Boolean).length === 0;
  if (view.kind === "jobResult") return "Couldn't load these job results";
  if (view.kind === "public") {
    return atRoot ? "Couldn't load public workspaces" : "Couldn't load this folder";
  }
  if (view.kind === "shared" && view.atRoot) return "Couldn't load your workspaces";
  if (view.kind === "home" && atRoot) return "Couldn't load your home folder";
  return "Couldn't load this folder";
}

interface WorkspaceBrowserPresentationProps {
  selectedItems: WorkspaceItem[];
  actionBar: ReactNode;
  dialogs: ReactNode;
  notFoundDialog: ReactNode;
  path: string;
  username: string;
  /** Items in the folder; undefined while nothing has loaded. */
  itemCount: number | undefined;
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
  /** Why the folder could not be shown (listing or path lookup), or null. */
  error: Error | null;
  /** True when the listing has items to show despite `error` (a failed refetch). */
  hasLoadedItems: boolean;
  /** A Retry or Refresh is in flight while `error` stays on screen. */
  retrying: boolean;
  /** Refetches what failed: the path lookup and the listing. */
  onRetry: () => void;
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
  error,
  hasLoadedItems,
  retrying,
  onRetry,
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

  const errorTitle = loadErrorTitle(view, path);
  const errorMessage = error
    ? workspaceErrorMessage(error, "The workspace service returned an error.")
    : "";
  // Nothing loaded: the table shows the error where its rows would be.
  // Rows from an earlier load: they stay, with the error above them.
  const tableLoadError =
    error && !hasLoadedItems
      ? { title: errorTitle, message: errorMessage, retrying, onRetry }
      : null;

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
      loadError={tableLoadError}
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
        {error && hasLoadedItems && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{errorTitle}</AlertTitle>
            <AlertDescription>
              <p>{errorMessage}</p>
              <QueryRetryButton retrying={retrying} onRetry={onRetry} />
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
