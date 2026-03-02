"use client";

import { useState, useMemo, useCallback } from "react";
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
  Construction,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceBreadcrumbs } from "./workspace-breadcrumbs";
import { WorkspaceToolbar } from "./workspace-toolbar";
import { WorkspaceDataTable } from "./workspace-data-table";
import { InfoPanel } from "@/components/containers/InfoPanel";
import { WorkspaceActionBar } from "./workspace-action-bar";
import { isFolderType } from "./workspace-item-icon";
import { sortItems } from "@/lib/services/workspace/helpers";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { useJobResultData } from "@/hooks/services/workspace/use-job-result-data";
import { useWorkspaceListByPath } from "@/hooks/services/workspace/use-shared-with-user";
import {
  useWorkspacePanel,
  WORKSPACE_PANEL_IDS,
} from "@/contexts/workspace-panel-context";
import {
  computeNextSelection,
  normalizePath,
} from "@/lib/workspace/table-selection";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";
import type { WorkspaceBrowserItem, WorkspaceBrowserSort } from "@/types/workspace-browser";
import { encodeWorkspaceSegment, sanitizePathSegment } from "@/lib/utils";

export type WorkspaceViewMode = "home" | "shared";

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

function formatElapsedSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

function formatUnixTimestamp(ts: number | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return "—";
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
    setPanelManuallyHidden,
    panelExpanded,
    setPanelExpanded,
    panelLayout,
    setPanelLayout,
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

  const mainContent = (
    <div className="flex h-full flex-col overflow-hidden">
      <AlertDialog
        open={fileViewerConstructionOpen}
        onOpenChange={setFileViewerConstructionOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="flex items-center justify-center gap-2">
              <Construction className="h-6 w-6 text-amber-600" />
            </AlertDialogMedia>
            <AlertDialogTitle>File viewer coming soon</AlertDialogTitle>
            <AlertDialogDescription>
              The file viewer is still under construction. Please check back at
              a later date for this feature.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>OK</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          onSearchChange={() => {}}
          typeFilter="all"
          onTypeFilterChange={() => {}}
          onRefresh={() => {
            onRefetch?.();
            void listQuery.refetch();
          }}
          isRefreshing={listQuery.isFetching}
          showHiddenFiles={true}
          onShowHiddenFilesChange={() => {}}
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
  );

  const actionStrip = (
    <div className="border-border/50 bg-muted/50 flex h-full w-[80px] shrink-0 flex-col rounded-l-lg border-r py-2">
      <div className="relative mx-0.5 mb-1 h-8 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className={`absolute inset-0 h-full w-full justify-start gap-1 font-normal ${
            panelExpanded ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          onClick={() => {
            setPanelManuallyHidden(false);
            setPanelExpanded(true);
          }}
          title="Show details panel"
        >
          <PanelRightOpen className="h-4 w-4 shrink-0" />
          Show
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`absolute inset-0 h-full w-full justify-start gap-1 font-normal ${
            panelExpanded ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => {
            setPanelManuallyHidden(true);
            setPanelExpanded(false);
          }}
          title="Hide panel"
        >
          <PanelRightClose className="h-4 w-4 shrink-0" />
          Hide
        </Button>
      </div>
      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-1.5">
        <WorkspaceActionBar
          selection={selectedItems}
          workspaceGuideUrl={workspaceGuideUrl}
          onAction={onAction}
        />
      </div>
    </div>
  );

  const detailsPanelContent =
    selectedItems.length > 0 ? (
      <InfoPanel
        variant="workspace"
        selection={selectedItems}
        onClose={() => {
          setPanelManuallyHidden(true);
          setPanelExpanded(false);
        }}
      />
    ) : (
      <div className="flex h-full w-full flex-col overflow-hidden px-4 py-2">
        <div className="flex items-center justify-between gap-2 border-b pb-2">
          <h3 className="text-muted-foreground truncate text-sm font-semibold">
            Nothing selected
          </h3>
        </div>
        <div className="text-muted-foreground flex flex-1 items-center justify-center py-6 text-center text-sm">
          Select an item to view details
        </div>
      </div>
    );

  if (!panelExpanded) {
    return (
      <div className="flex h-full min-h-0 w-full flex-row gap-0">
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {mainContent}
        </div>
        <aside className="bg-muted/30 flex min-h-full shrink-0 rounded-tl-lg rounded-bl-lg border-l">
          {actionStrip}
        </aside>
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full min-h-0 w-full"
      defaultLayout={panelLayout}
      onLayoutChanged={setPanelLayout}
    >
      <ResizablePanel
        id={WORKSPACE_PANEL_IDS.main}
        defaultSize={panelLayout[WORKSPACE_PANEL_IDS.main] ?? 75}
        minSize={50}
        className="flex h-full min-h-0 flex-row overflow-hidden"
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {mainContent}
        </div>
        <aside className="bg-muted/30 flex min-h-full shrink-0 rounded-tl-lg rounded-bl-lg border-l">
          {actionStrip}
        </aside>
      </ResizablePanel>
      <ResizableHandle withHandle className="shrink-0" />
      <ResizablePanel
        id={WORKSPACE_PANEL_IDS.details}
        defaultSize={panelLayout[WORKSPACE_PANEL_IDS.details] ?? 25}
        minSize={110}
        maxSize={600}
        className="flex min-h-0 flex-col overflow-hidden py-2"
      >
        {detailsPanelContent}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
