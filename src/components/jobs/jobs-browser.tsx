"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlexRender, type Row } from "@tanstack/react-table";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import { useKillJob } from "@/hooks/services/workspace/use-workspace";
import { useJobsData } from "@/hooks/services/jobs/use-jobs-data";
import { useJobsSummary } from "@/hooks/services/jobs/use-jobs-summary";
import {
  DataTable,
  type DataTableSort,
  type FileTableFeatures,
  useDataTableBody,
} from "@/components/shared/file-table";
import { useTableKeyboardNavigation } from "@/hooks/use-table-keyboard-navigation";
import { useJobsColumns } from "./jobs-table-columns";
import { JobsToolbar } from "./jobs-toolbar";
import { JobsActionBar } from "./jobs-action-bar";
import { JobsPagination } from "./jobs-pagination";
import { JobDetailsPanel } from "./jobs-detail-panel";
import { JobsShell } from "./jobs-shell";
import { DetailPanel } from "@/components/detail-panel";
import type { JobListItem } from "@/types/workspace";
import { encodeWorkspaceSegment } from "@/lib/services/workspace/path-utils";
import { rerunJob } from "@/lib/rerun-utility";
import {
  defaultPageSize,
  defaultJobsColumnOrder,
  activeJobStatuses,
} from "@/lib/jobs/constants";
import { clsx } from "cn";

interface JobDataRowProps {
  row: Row<FileTableFeatures, JobListItem>;
  isSelected: boolean;
  onSelect: (job: JobListItem, modifiers?: { ctrlOrMeta: boolean }) => void;
  onDoubleClick: (job: JobListItem) => void;
}

function JobDataRow({
  row,
  isSelected,
  onSelect,
  onDoubleClick,
}: JobDataRowProps) {
  return (
    <TableRow
      className={clsx(
        "cursor-pointer border-l-2",
        isSelected ? "border-l-primary bg-muted" : "border-l-transparent",
      )}
      onClick={(e) => {
        onSelect(row.original, {
          ctrlOrMeta: e.ctrlKey || e.metaKey,
        });
      }}
      onDoubleClick={() => {
        onDoubleClick(row.original);
      }}
      onMouseDown={(e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault();
      }}
      aria-selected={isSelected}
    >
      {row.getVisibleCells().map((cell, cellIndex) => {
        // eslint-disable-next-line shadcn/require-static-classes -- column classes come from TanStack column meta, authored as static strings in the column definitions
        const metaCls = cell.column.columnDef.meta?.className;
        const className = clsx(
          cellIndex === 0 ? "pl-6" : "pl-2",
          "overflow-hidden",
          metaCls ?? "",
        );
        return (
          <TableCell
            key={cell.id}
            className={className}
            style={{
              width: `var(--col-${cell.column.id}-size)`,
              minWidth: `var(--col-${cell.column.id}-size)`,
              maxWidth: `var(--col-${cell.column.id}-size)`,
            }}
          >
            <FlexRender cell={cell} />
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function JobsTableBody({
  selectedIds,
  searchQuery,
  statusFilter,
  serviceFilter,
  onSelect,
  onDoubleClick,
}: {
  selectedIds: Set<string>;
  searchQuery: string;
  statusFilter: string;
  serviceFilter: string;
  onSelect: JobDataRowProps["onSelect"];
  onDoubleClick: JobDataRowProps["onDoubleClick"];
}) {
  const { rows, colSpan } = useDataTableBody<JobListItem>();

  if (rows.length === 0) {
    return (
      <TableRow>
        <TableCell
          colSpan={colSpan}
          className="py-12 pl-6 text-center text-muted-foreground"
        >
          {searchQuery || statusFilter !== "all" || serviceFilter !== "all"
            ? "No jobs match your filters"
            : "No jobs found"}
        </TableCell>
      </TableRow>
    );
  }

  return rows.map((row) => (
    <JobDataRow
      key={row.id}
      row={row}
      isSelected={selectedIds.has(row.original.id)}
      onSelect={onSelect}
      onDoubleClick={onDoubleClick}
    />
  ));
}

function useJobsBrowser() {
  const router = useRouter();

  // State
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<DataTableSort>({
    field: "submit_time",
    direction: "desc",
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showJobNotFound, setShowJobNotFound] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const toLocalDate = (date: Date) =>
    `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const startTime = dateFrom ? toLocalDate(dateFrom) : undefined;
  let endTime: string | undefined;
  if (dateTo) {
    const inclusive = new Date(dateTo);
    inclusive.setDate(inclusive.getDate() + 1);
    endTime = toLocalDate(inclusive);
  }

  // Data fetching
  const { data: summaryData } = useJobsSummary(includeArchived);
  const statusSummary = summaryData?.taskSummary;
  const appSummary = summaryData?.appSummary;

  const hasActiveJobs = activeJobStatuses.some(
    (s) => (statusSummary?.[s] ?? 0) > 0,
  );
  const {
    data: jobsResult,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useJobsData({
    offset,
    limit: pageSize,
    includeArchived,
    sortField: sort.field,
    sortOrder: sort.direction,
    app: serviceFilter !== "all" ? serviceFilter : undefined,
    startTime,
    endTime,
    refetchInterval: hasActiveJobs ? 10_000 : 30_000,
  });

  const jobs = jobsResult?.jobs ?? [];
  const totalTasks = jobsResult?.totalTasks ?? 0;

  // Kill mutation
  const killMutation = useKillJob();

  // Derived data
  const availableServices = appSummary ? Object.keys(appSummary).sort() : [];

  // Client-side filters (status, search) applied to the current page
  // Note: serviceFilter is handled server-side via the `app` param in useJobsData
  const filteredJobs = jobs.filter((job) => {
    if (!job.id || !job.app) return false;

    if (statusFilter !== "all") {
      const isRunning =
        statusFilter === "running" &&
        (job.status === "running" || job.status === "in-progress");
      if (!isRunning && job.status !== statusFilter) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const outputName =
        job.output_file ??
        (job.parameters.output_file as string | undefined) ??
        "";
      const matches =
        job.id.toLowerCase().includes(q) ||
        job.app.toLowerCase().includes(q) ||
        outputName.toLowerCase().includes(q);
      if (!matches) return false;
    }

    return true;
  });

  // Selection
  const selectedJobs = filteredJobs.filter((job) => selectedIds.has(job.id));

  const handleSelect = (
    job: JobListItem,
    modifiers?: { ctrlOrMeta: boolean },
  ) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (modifiers?.ctrlOrMeta) {
        if (next.has(job.id)) next.delete(job.id);
        else next.add(job.id);
      } else {
        next.clear();
        next.add(job.id);
      }
      return next;
    });
  };

  // Columns
  const { columns, handleSort } = useJobsColumns(sort, setSort);

  // Pagination
  const handlePrevious = () => {
    setOffset((prev) => Math.max(0, prev - pageSize));
    setSelectedIds(new Set());
  };

  const handleNext = () => {
    setOffset((prev) => prev + pageSize);
    setSelectedIds(new Set());
  };

  const handlePageChange = (page: number) => {
    setOffset((page - 1) * pageSize);
    setSelectedIds(new Set());
  };

  // Reset offset when filters change
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setOffset(0);
    setSelectedIds(new Set());
  };

  const handleServiceFilterChange = (value: string) => {
    setServiceFilter(value);
    setOffset(0);
    setSelectedIds(new Set());
  };

  const handleArchivedChange = (value: boolean) => {
    setIncludeArchived(value);
    setOffset(0);
    setSelectedIds(new Set());
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setOffset(0);
    setSelectedIds(new Set());
  };

  const handleDateFilterChange = (
    from: Date | undefined,
    to: Date | undefined,
  ) => {
    setDateFrom(from);
    setDateTo(to);
    setOffset(0);
    setSelectedIds(new Set());
  };

  // Row rendering & keyboard
  const handleDoubleClick = (job: JobListItem) => {
    const outputPath =
      job.output_path ??
      (job.parameters.output_path as string | undefined) ??
      "";
    const outputFile =
      job.output_file ??
      (job.parameters.output_file as string | undefined) ??
      "";

    if (outputPath && outputFile) {
      const fullPath = `${outputPath}/${outputFile}`;
      const segments = fullPath.replace(/^\/+/, "").split("/").filter(Boolean);
      const encoded = segments.map(encodeWorkspaceSegment).join("/");
      router.push(`/workspace/${encoded}`);
    } else {
      setShowJobNotFound(true);
    }
  };

  // Actions
  const handleAction = (actionId: string, selection: JobListItem[]) => {
    if (selection.length === 0) return;
    const job = selection[0];
    switch (actionId) {
      case "view":
        handleDoubleClick(job);
        break;
      case "rerun": {
        // Every failure — a pop-up blocker refusing the tab, an unsupported
        // service — would otherwise look like a rerun that opened. `rerunJob`
        // reports nothing itself, so the toast has to cover all of them.
        const launch = rerunJob(job.parameters, job.app);
        if (launch.status !== "opened") toast.error(launch.message);
        break;
      }
      case "show":
        if (job.output_path) {
          const segments = job.output_path
            .replace(/^\/+/, "")
            .split("/")
            .filter(Boolean);
          const encoded = segments.map(encodeWorkspaceSegment).join("/");
          router.push(`/workspace/${encoded}`);
        }
        break;
      case "kill":
        for (const selectedJob of selection) {
          killMutation.mutate(selectedJob.id);
        }
        break;
    }
  };

  const getFocusedIndex = () => {
    const selectedArray = Array.from(selectedIds);
    if (selectedArray.length === 0) return -1;
    const focusId = selectedArray[selectedArray.length - 1];
    return filteredJobs.findIndex((job) => job.id === focusId);
  };

  const { handleKeyDown } = useTableKeyboardNavigation<JobListItem>({
    items: filteredJobs,
    getFocusedIndex,
    onSelect: handleSelect,
    onEnter: handleDoubleClick,
  });

  // Details panel content
  const detailsPanel =
    selectedJobs.length === 1 ? (
      <JobDetailsPanel job={selectedJobs[0]} />
    ) : selectedJobs.length > 1 ? (
      <DetailPanel.EmptyState
        message={`${String(selectedJobs.length)} jobs selected`}
      />
    ) : (
      <DetailPanel.EmptyState message="Select a job to view details" />
    );

  return (
    <JobsShell
      actionBar={
        <JobsActionBar
          selection={selectedJobs}
          loadingActionIds={killMutation.isPending ? ["kill"] : []}
          onAction={handleAction}
        />
      }
      detailsPanel={detailsPanel}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header + toolbar */}
        <div className="min-w-0 shrink-0 space-y-4 overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                Error loading jobs: {error.message}
              </AlertDescription>
            </Alert>
          )}

          <JobsToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            serviceFilter={serviceFilter}
            onServiceFilterChange={handleServiceFilterChange}
            availableServices={availableServices}
            appSummary={appSummary}
            includeArchived={includeArchived}
            onIncludeArchivedChange={handleArchivedChange}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            statusSummary={statusSummary}
            dataUpdatedAt={dataUpdatedAt}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFilterChange={handleDateFilterChange}
          />
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1">
          <DataTable<JobListItem>
            data={filteredJobs}
            columns={columns}
            defaultColumnOrder={defaultJobsColumnOrder}
            isLoading={isLoading}
            getRowId={(row) => row.id}
            sort={sort}
            onSort={handleSort}
            dndId="jobs-table-dnd"
            onKeyDown={handleKeyDown}
            ariaLabel="Jobs list"
            tabIndex={0}
          >
            <JobsTableBody
              selectedIds={selectedIds}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              serviceFilter={serviceFilter}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
            />
          </DataTable>
        </div>

        {/* Pagination */}
        <div className="shrink-0 border-t">
          <JobsPagination
            offset={offset}
            limit={pageSize}
            totalOnPage={filteredJobs.length}
            totalTasks={totalTasks}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onPageSizeChange={handlePageSizeChange}
            onPageChange={handlePageChange}
          />
        </div>
      </div>
      <AlertDialog open={showJobNotFound} onOpenChange={setShowJobNotFound}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <TriangleAlert className="text-muted-foreground" />
            </AlertDialogMedia>
            <AlertDialogTitle>Job not found</AlertDialogTitle>
            <AlertDialogDescription>
              The job output could not be located. It may still be processing or
              the output path is unavailable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowJobNotFound(false);
              }}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </JobsShell>
  );
}

export function JobsBrowser() {
  return useJobsBrowser();
}
