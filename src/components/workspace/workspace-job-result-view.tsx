"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceBreadcrumbs } from "./workspace-breadcrumbs";
import { WorkspaceToolbar } from "./workspace-toolbar";
import {
  WorkspaceDataTable,
  type WorkspaceDataTableHandle,
} from "./workspace-data-table";
import { WorkspaceActionBar } from "./workspace-action-bar";
import { WorkspaceShell } from "./workspace-shell";
import { FileViewerConstructionDialog } from "./file-viewer-construction-dialog";
import { isFolderType } from "@/lib/services/workspace/utils";
import { sortItems } from "@/lib/services/workspace/helpers";
import { Button } from "@/components/ui/button";
import { useJobResultData } from "@/hooks/services/workspace/use-job-result-data";
import { useWorkspaceListByPath } from "@/hooks/services/workspace/use-shared-with-user";
import { useWorkspacePanel } from "@/contexts/workspace-panel-context";
import {
  computeNextSelection,
  normalizePath,
} from "@/lib/workspace/table-selection";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";
import type { WorkspaceBrowserItem, WorkspaceBrowserSort, WorkspaceViewMode } from "@/types/workspace-browser";
import { encodeWorkspaceSegment, noop, sanitizePathSegment } from "@/lib/utils";
import { formatElapsedSeconds, formatUnixTimestamp } from "@/lib/jobs/formatting";

interface WorkspaceJobResultViewProps {
  path: string;
  username: string;
  viewMode: WorkspaceViewMode;
  resolvedJobMeta: ResolvedPathObject;
  workspaceGuideUrl: string;
  currentUser?: string;
  myWorkspaceRoot?: string;
  onAction?: (actionId: string, selection: WorkspaceBrowserItem[]) => void;
  onRefetch?: () => void;
}

/** Dot path relative to workspace for URL (e.g. "ProteinMPNN_tests/.1e08_dwnld_d10010111"). */
function getDotPathRelative(path: string, jobName: string): string {
  const segments = path.split("/").map(sanitizePathSegment).filter(Boolean);
  const withoutLast = segments.slice(0, -1);
  const base = withoutLast.length > 0 ? withoutLast.join("/") : "";
  return base ? `${base}/.${jobName}` : `.${jobName}`;
}

export function WorkspaceJobResultView({
  path,
  username,
  viewMode,
  resolvedJobMeta,
  workspaceGuideUrl,
  currentUser,
  myWorkspaceRoot,
  onAction,
  onRefetch,
}: WorkspaceJobResultViewProps) {
  const router = useRouter();
  const {
    panelManuallyHidden,
    setPanelExpanded,
  } = useWorkspacePanel();

  const { dotPath } = useJobResultData({
    resolvedJobMeta,
    enabled: true,
  });
  const dotPathNormalized = dotPath.startsWith("/") ? dotPath : `/${dotPath}`;
  const listQuery = useWorkspaceListByPath({
    fullPath: dotPathNormalized,
    enabled: !!dotPath,
  });
  const dotItems = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const isLoadingList = listQuery.isLoading;

  const [selectedItems, setSelectedItems] = useState<WorkspaceBrowserItem[]>([]);
  const [anchorPath, setAnchorPath] = useState<string | null>(null);
  const [sort, setSort] = useState<WorkspaceBrowserSort>({
    field: "name",
    direction: "asc",
  });
  const [parametersOpen, setParametersOpen] = useState(false);
  const [fileViewerConstructionOpen, setFileViewerConstructionOpen] =
    useState(false);

  const tableRef = useRef<WorkspaceDataTableHandle>(null);

  // Focus the table when the job result view mounts and after its list data loads
  useEffect(() => {
    if (isLoadingList) return;
    const id = setTimeout(() => tableRef.current?.focus(), 100);
    return () => clearTimeout(id);
  }, [isLoadingList]);

  const processedItems = useMemo(
    () => sortItems(dotItems, sort),
    [dotItems, sort],
  );

  const meta = resolvedJobMeta.jobSysMeta;
  const taskData = resolvedJobMeta.taskData;
  const jobId = meta?.id ?? taskData?.task_id ?? "—";
  const startTime = meta?.start_time ?? taskData?.start_time;
  const endTime = meta?.end_time ?? taskData?.end_time;
  const elapsed = meta?.elapsed_time ?? taskData?.elapsed_time;
  const appLabel = meta?.app?.label ?? taskData?.app_id ?? resolvedJobMeta.name;
  const parameters = meta?.parameters ?? {};
  const title = `${appLabel} Job Result`;

  const dotPathRelative = getDotPathRelative(path, resolvedJobMeta.name);

  const handleItemDoubleClick = useCallback(
    (item: WorkspaceBrowserItem) => {
      if (!isFolderType(item.type)) return;
      const pathToNavigate = `${dotPathRelative}/${sanitizePathSegment(item.name ?? "")}`;
      const segments = pathToNavigate.split("/").filter(Boolean);
      const encoded = segments.map(encodeWorkspaceSegment).join("/");
      if (viewMode === "home") {
        const homeBase = `/workspace/${encodeWorkspaceSegment(username)}/home`;
        router.push(`${homeBase}/${encoded}`);
      } else {
        router.push(`/workspace/${encoded}`);
      }
      setSelectedItems([]);
      setAnchorPath(null);
    },
    [dotPathRelative, viewMode, username, router],
  );

  const handleSelectItem = useCallback(
    (item: WorkspaceBrowserItem, modifiers?: { ctrlOrMeta: boolean; shift: boolean }) => {
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
    [
      processedItems,
      selectedItems,
      anchorPath,
      panelManuallyHidden,
      setPanelExpanded,
    ],
  );

  return (
    <WorkspaceShell
      selectedItems={selectedItems}
      workspaceGuideUrl={workspaceGuideUrl}
      actionBar={
        <WorkspaceActionBar
          selection={selectedItems}
          workspaceGuideUrl={workspaceGuideUrl}
          onAction={onAction}
        />
      }
    >
      <div className="flex h-full flex-col overflow-hidden">
        <FileViewerConstructionDialog
          open={fileViewerConstructionOpen}
          onOpenChange={setFileViewerConstructionOpen}
        />
        <div className="min-w-0 shrink-0 space-y-4 overflow-hidden p-4">
          <WorkspaceBreadcrumbs
            path={path}
            username={username}
            itemCount={dotItems.length}
            viewMode={viewMode === "home" ? "home" : "shared"}
            currentUsername={currentUser}
            workspaceRootUsername={viewMode === "home" ? undefined : myWorkspaceRoot}
          />
          <WorkspaceToolbar
            searchQuery=""
            onSearchChange={noop}
            typeFilter="all"
            onTypeFilterChange={noop}
            onRefresh={() => {
              onRefetch?.();
              void listQuery.refetch();
            }}
            isRefreshing={listQuery.isFetching}
            showHiddenFiles={true}
            onShowHiddenFilesChange={noop}
          />
        </div>

        <div className="border-border flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-4">
          <div className="border-border flex shrink-0 flex-col gap-2 rounded-md border p-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Job ID</dt>
                <dd className="font-mono text-xs">{jobId}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Run time</dt>
                <dd>{formatElapsedSeconds(elapsed ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Start time</dt>
                <dd>{formatUnixTimestamp(startTime)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">End time</dt>
                <dd>{formatUnixTimestamp(endTime)}</dd>
              </div>
            </dl>

            <Collapsible open={parametersOpen} onOpenChange={setParametersOpen} className="service-collapsible-container p-1!">
              <CollapsibleTrigger className="service-collapsible-trigger text-sm">
                {parametersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Parameters
              </CollapsibleTrigger>
              <CollapsibleContent className="service-collapsible-content">
                <div className="relative mt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute right-4 top-2 z-10 h-10 w-10 p-3 border border-border rounded-sm text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const text = JSON.stringify(parameters, null, 2);
                      void navigator.clipboard.writeText(text).then(
                        () => toast.success("Parameters copied to clipboard"),
                        () => toast.error("Failed to copy"),
                      );
                    }}
                    title="Copy to clipboard"
                  >
                    <ClipboardCopy className="h-5 w-5" />
                  </Button>
                  <pre className="scrollbar-themed bg-muted/50 max-h-48 overflow-auto rounded p-2 pr-10 font-mono text-xs">
                    {JSON.stringify(parameters, null, 2)}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="min-h-0 flex-1">
            <WorkspaceDataTable
              ref={tableRef}
              items={processedItems}
              isLoading={isLoadingList}
              path={path}
              sort={sort}
              onSortChange={setSort}
              showViewSharedRow={false}
              viewMode={viewMode}
              username={username}
              sharedRootUsername={viewMode === "home" ? undefined : myWorkspaceRoot}
              selectedPaths={selectedItems.map((i) => normalizePath(i.path))}
              onSelect={handleSelectItem}
              onItemDoubleClick={handleItemDoubleClick}
              onOpenFileRequested={() => setFileViewerConstructionOpen(true)}
              onClearSelection={() => {
                setSelectedItems([]);
                setAnchorPath(null);
              }}
            />
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
