"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Row } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import clsx from "clsx";
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
import { DataTable, type DataTableSort } from "@/components/shared/file-table";
import { useTableKeyboardNavigation } from "@/hooks/use-table-keyboard-navigation";
import { useJobsColumns } from "./jobs-table-columns";
import { JobsToolbar } from "./jobs-toolbar";
import { JobsActionBar } from "./jobs-action-bar";
import { JobsPagination } from "./jobs-pagination";
import { JobDetailsPanel } from "./jobs-detail-panel";
import { JobsShell } from "./jobs-shell";
import { DetailPanel } from "@/components/detail-panel";
import type { JobListItem } from "@/types/workspace";
import { encodeWorkspaceSegment } from "@/lib/utils";
import { rerunJob } from "@/lib/rerun-utility";
import {
  defaultPageSize,
  defaultJobsColumnOrder,
  activeJobStatuses,
} from "@/lib/jobs/constants";

interface JobDataRowProps {
  row: Row<JobListItem>;
  isSelected: boolean;
  onSelect: (job: JobListItem, modifiers?: { ctrlOrMeta: boolean }) => void;
  onDoubleClick: (job: JobListItem) => void;
}

const JobDataRow = React.memo(function JobDataRow({
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
      onClick={(e) =>
        onSelect(row.original, {
          ctrlOrMeta: e.ctrlKey || e.metaKey,
        })
      }
      onDoubleClick={() => onDoubleClick(row.original)}
      onMouseDown={(e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault();
      }}
      aria-selected={isSelected}
    >
      {row.getVisibleCells().map((cell, cellIndex) => {
        const meta = cell.column.columnDef.meta as
          | { className?: string }
          | undefined;
        const className = clsx(
          cellIndex === 0 ? "pl-6" : "pl-2",
          "overflow-hidden",
          meta?.className ?? "",
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
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );
});

export function JobsBrowser() {
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

  const dateParams = useMemo(() => {
    const toLocalDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const startTime = dateFrom ? toLocalDate(dateFrom) : undefined;
    let endTime: string | undefined;
    if (dateTo) {
      const inclusive = new Date(dateTo);
      inclusive.setDate(inclusive.getDate() + 1);
      endTime = toLocalDate(inclusive);
    }
    return { startTime, endTime };
  }, [dateFrom, dateTo]);

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
    startTime: dateParams.startTime,
    endTime: dateParams.endTime,
    refetchInterval: hasActiveJobs ? 10_000 : 30_000,
  });

  const jobs = useMemo(() => jobsResult?.jobs ?? [], [jobsResult]);
  const totalTasks = jobsResult?.totalTasks ?? 0;

  // Kill mutation
  const killMutation = useKillJob();

  // Derived data
  const availableServices = useMemo(() => {
    if (!appSummary) return [];
    return Object.keys(appSummary).sort();
  }, [appSummary]);

  // Client-side filters (status, search) applied to the current page
  // Note: serviceFilter is handled server-side via the `app` param in useJobsData
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!job?.id || !job?.app) return false;

      if (statusFilter !== "all") {
        const isRunning =
          statusFilter === "running" &&
          (job.status === "running" || job.status === "in-progress");
        if (!isRunning && job.status !== statusFilter) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const outputName =
          job.output_file ?? String(job.parameters?.output_file ?? "");
        const matches =
          job.id.toLowerCase().includes(q) ||
          job.app.toLowerCase().includes(q) ||
          outputName.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [jobs, statusFilter, searchQuery]);

  // Selection
  const selectedJobs = useMemo(
    () => filteredJobs.filter((j) => selectedIds.has(j.id)),
    [filteredJobs, selectedIds],
  );

  const handleSelect = useCallback(
    (job: JobListItem, modifiers?: { ctrlOrMeta: boolean }) => {
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
    },
    [],
  );

  // Columns
  const { columns, handleSort } = useJobsColumns(sort, setSort);

  // Pagination
  const handlePrevious = useCallback(() => {
    setOffset((prev) => Math.max(0, prev - pageSize));
    setSelectedIds(new Set());
  }, [pageSize]);

  const handleNext = useCallback(() => {
    setOffset((prev) => prev + pageSize);
    setSelectedIds(new Set());
  }, [pageSize]);

  const handlePageChange = useCallback(
    (page: number) => {
      setOffset((page - 1) * pageSize);
      setSelectedIds(new Set());
    },
    [pageSize],
  );

  // Reset offset when filters change
  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
    setOffset(0);
    setSelectedIds(new Set());
  }, []);

  const handleServiceFilterChange = useCallback((value: string) => {
    setServiceFilter(value);
    setOffset(0);
    setSelectedIds(new Set());
  }, []);

  const handleArchivedChange = useCallback((value: boolean) => {
    setIncludeArchived(value);
    setOffset(0);
    setSelectedIds(new Set());
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setOffset(0);
    setSelectedIds(new Set());
  }, []);

  const handleDateFilterChange = useCallback(
    (from: Date | undefined, to: Date | undefined) => {
      setDateFrom(from);
      setDateTo(to);
      setOffset(0);
      setSelectedIds(new Set());
    },
    [],
  );

  // Row rendering & keyboard
  const handleDoubleClick = useCallback(
    (job: JobListItem) => {
      const outputPath =
        job.output_path ?? String(job.parameters?.output_path ?? "");
      const outputFile =
        job.output_file ?? String(job.parameters?.output_file ?? "");

      if (outputPath && outputFile) {
        const fullPath = `${outputPath}/${outputFile}`;
        const segments = fullPath
          .replace(/^\/+/, "")
          .split("/")
          .filter(Boolean);
        const encoded = segments.map(encodeWorkspaceSegment).join("/");
        router.push(`/workspace/${encoded}`);
      } else {
        setShowJobNotFound(true);
      }
    },
    [router],
  );

  // Actions
  const handleAction = useCallback(
    (actionId: string, selection: JobListItem[]) => {
      const job = selection[0];
      if (!job) return;
      switch (actionId) {
        case "view":
          handleDoubleClick(job);
          break;
        case "rerun":
          rerunJob(
            job.parameters as Record<string, unknown>,
            job.app,
          );
          break;
        case "show":
          if (job.output_path) {
            // Navigate to workspace output folder
            const segments = job.output_path
              .replace(/^\/+/, "")
              .split("/")
              .filter(Boolean);
            const encoded = segments.map(encodeWorkspaceSegment).join("/");
            router.push(`/workspace/${encoded}`);
          }
          break;
        case "kill":
          for (const j of selection) {
            killMutation.mutate(j.id);
          }
          break;
      }
    },
    [router, killMutation, handleDoubleClick],
  );

  const getFocusedIndex = useCallback(() => {
    const selectedArray = Array.from(selectedIds);
    if (selectedArray.length === 0) return -1;
    const focusId = selectedArray[selectedArray.length - 1];
    return filteredJobs.findIndex((j) => j.id === focusId);
  }, [selectedIds, filteredJobs]);

  const { handleKeyDown } = useTableKeyboardNavigation<JobListItem>({
    items: filteredJobs,
    getFocusedIndex,
    onSelect: handleSelect,
    onEnter: handleDoubleClick,
  });

  const renderRows = useCallback(
    (rows: Row<JobListItem>[]) => (
      <>
        {rows.map((row) => (
          <JobDataRow
            key={row.id}
            row={row}
            isSelected={selectedIds.has(row.original.id)}
            onSelect={handleSelect}
            onDoubleClick={handleDoubleClick}
          />
        ))}
      </>
    ),
    [selectedIds, handleSelect, handleDoubleClick],
  );

  const renderEmptyState = useCallback(
    (colSpan: number) => (
      <TableRow>
        <TableCell
          colSpan={colSpan}
          className="text-muted-foreground py-12 pl-6 text-center"
        >
          {searchQuery || statusFilter !== "all" || serviceFilter !== "all"
            ? "No jobs match your filters"
            : "No jobs found"}
        </TableCell>
      </TableRow>
    ),
    [searchQuery, statusFilter, serviceFilter],
  );

  // Details panel content
  const detailsPanel =
    selectedJobs.length === 1 ? (
      <JobDetailsPanel job={selectedJobs[0]} />
    ) : selectedJobs.length > 1 ? (
      <DetailPanel.EmptyState
        message={`${selectedJobs.length} jobs selected`}
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
            <h1 className="text-foreground text-2xl font-bold">Jobs</h1>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
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
            renderRows={renderRows}
            renderEmptyState={renderEmptyState}
            onKeyDown={handleKeyDown}
            ariaLabel="Jobs list"
            tabIndex={0}
          />
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
            <AlertDialogAction onClick={() => setShowJobNotFound(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </JobsShell>
  );
}
