"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlexRender, type Row } from "@tanstack/react-table";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useJobsUrlState } from "@/hooks/services/jobs/use-jobs-url-state";
import { useDebouncedDraft } from "@/hooks/use-debounced-draft";
import {
  DataTable,
  type DataTableSort,
  type FileTableFeatures,
  orderedCells,
  useDataTableBody,
} from "@/components/shared/file-table";
import { useTableKeyboardNavigation } from "@/hooks/use-table-keyboard-navigation";
import { useJobsColumns } from "./jobs-table-columns";
import { JobsToolbar } from "./jobs-toolbar";
import { JobsActionBar } from "./jobs-action-bar";
import { JobsPagination, type JobsListStatus } from "./jobs-pagination";
import { JobDetailsPanel } from "./jobs-detail-panel";
import { JobsShell } from "./jobs-shell";
import { DetailPanel } from "@/components/detail-panel";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { useKeptQueryError } from "@/hooks/services/jobs/use-kept-query-error";
import type { JobListItem } from "@/types/workspace";
import { encodeWorkspaceSegment } from "@/lib/services/workspace/path-utils";
import { getJobResultHref } from "@/lib/jobs/formatting";
import { rerunJob } from "@/lib/rerun-utility";
import {
  defaultJobsColumnOrder,
  activeJobStatuses,
} from "@/lib/jobs/constants";
import {
  fromLocalDateParam,
  toLocalDateParam,
} from "@/lib/jobs/jobs-url-state";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { clsx } from "cn";

/** `formatUserFacingErrorMessage` fallback for a failed job list read. */
const jobsErrorFallback = "The job list could not be loaded. Please try again.";

/** `formatUserFacingErrorMessage` fallback for a failed job summary read. */
const summaryErrorFallback = "The job summary could not be loaded.";

/**
 * In place of the table when the list failed and there is nothing to show.
 * It stays up, its button reading "Retrying…", until the retry answers.
 */
function JobsLoadError({
  error,
  retrying,
  onRetry,
}: {
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="px-4">
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Could not load jobs</AlertTitle>
        <AlertDescription>
          <p>{formatUserFacingErrorMessage(error, jobsErrorFallback)}</p>
          <QueryRetryButton retrying={retrying} onRetry={onRetry} />
        </AlertDescription>
      </Alert>
    </div>
  );
}

/**
 * A poll failed after the list had loaded: the rows stay (they were right a
 * moment ago) and this says they may be out of date, without taking over.
 */
function JobsRefreshError({
  error,
  retrying,
  onRetry,
}: {
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Alert size="sm" role="status">
      <TriangleAlert />
      <AlertTitle>Could not refresh jobs</AlertTitle>
      <AlertDescription>
        <p>
          {formatUserFacingErrorMessage(error, jobsErrorFallback)} The list
          shows the last update.
        </p>
        <QueryRetryButton retrying={retrying} onRetry={onRetry} />
      </AlertDescription>
    </Alert>
  );
}

interface JobDataRowProps {
  row: Row<FileTableFeatures, JobListItem>;
  // See orderedCells: the compiled row caches its cells on `row`, which a
  // column reorder does not replace.
  columnOrder: string[];
  isSelected: boolean;
  onSelect: (job: JobListItem, modifiers?: { ctrlOrMeta: boolean }) => void;
  onDoubleClick: (job: JobListItem) => void;
}

function JobDataRow({
  row,
  columnOrder,
  isSelected,
  onSelect,
  onDoubleClick,
}: JobDataRowProps) {
  return (
    <TableRow
      className="cursor-pointer"
      selectionIndicator
      data-state={isSelected ? "selected" : undefined}
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
      {orderedCells(row, columnOrder).map((cell, cellIndex) => {
        // eslint-disable-next-line shadcn/require-static-classes -- column classes come from TanStack column meta, authored as static strings in the column definitions
        const metaCls = cell.column.columnDef.meta?.className;
        const className = clsx(
          cellIndex === 0 ? "pl-6" : "pl-2",
          "overflow-hidden",
          metaCls ?? "",
        );
        return (
          <TableCell key={cell.id} className={className}>
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
  const { rows, colSpan, columnOrder } = useDataTableBody<JobListItem>();

  if (rows.length === 0) {
    return (
      <TableRow>
        <TableCell
          colSpan={colSpan}
          className="py-12 pl-6 text-center"
        >
          <span className="text-muted-foreground">
            {searchQuery || statusFilter !== "all" || serviceFilter !== "all"
              ? "No jobs match your filters"
              : "No jobs found"}
          </span>
        </TableCell>
      </TableRow>
    );
  }

  return rows.map((row) => (
    <JobDataRow
      key={row.id}
      row={row}
      columnOrder={columnOrder}
      isSelected={selectedIds.has(row.original.id)}
      onSelect={onSelect}
      onDoubleClick={onDoubleClick}
    />
  ));
}

function useJobsBrowser() {
  const router = useRouter();

  // List state (filters, sort, page) lives in the URL; selection and the
  // not-found dialog stay local.
  const [listState, setListState] = useJobsUrlState();
  const {
    status: statusFilter,
    service: serviceFilter,
    includeArchived,
    sort,
    page,
    pageSize,
  } = listState;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showJobNotFound, setShowJobNotFound] = useState(false);

  // The search box shows a draft: Next applies URL writes inside a transition,
  // which a controlled text input cannot follow. The list filters from the
  // draft; the URL `q` follows after a pause, and one run of search edits is one
  // history entry, pushed on top of whichever filter came before it.
  const [searchQuery, setSearchQuery] = useDebouncedDraft(
    listState.search,
    (value) => {
      setListState({ search: value }, { history: "coalesce" });
    },
  );

  const offset = (page - 1) * pageSize;
  const dateFrom = listState.dateFrom
    ? fromLocalDateParam(listState.dateFrom)
    : undefined;
  const dateTo = listState.dateTo
    ? fromLocalDateParam(listState.dateTo)
    : undefined;
  const startTime = listState.dateFrom;
  let endTime: string | undefined;
  if (dateTo) {
    const inclusive = new Date(dateTo);
    inclusive.setDate(inclusive.getDate() + 1);
    endTime = toLocalDateParam(inclusive);
  }
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Data fetching
  const summaryQuery = useJobsSummary(includeArchived);
  const summaryData = summaryQuery.data;
  // A back-off poll of a summary that never loaded must not hide its error.
  const summaryError = useKeptQueryError(
    { error: summaryQuery.error, hasData: summaryData !== undefined },
    String(includeArchived),
  );
  const statusSummary = summaryData?.taskSummary;
  const appSummary = summaryData?.appSummary;

  const hasActiveJobs = activeJobStatuses.some(
    (s) => (statusSummary?.[s] ?? 0) > 0,
  );
  const {
    data: jobsResult,
    isPlaceholderData,
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

  // The list query's own identity: the kept error of one page or filter is
  // never shown for another.
  const listIdentity = JSON.stringify([
    offset,
    pageSize,
    includeArchived,
    sort.field,
    sort.direction,
    serviceFilter,
    startTime,
    endTime,
  ]);
  // Rows kept from the previous page (`keepPreviousData`) are not this
  // query's: they may stand in while it loads, never next to its failure.
  const hasListData = jobsResult !== undefined && !isPlaceholderData;
  // The failure stays up through back-off polls (useKeptQueryError) and
  // through a Retry, whose button says it is retrying (useRetryKeepingError).
  const keptListError = useKeptQueryError(
    { error, hasData: hasListData },
    listIdentity,
  );
  const listRetry = useRetryKeepingError(
    { error: keptListError, isFetching, refetch },
    listIdentity,
  );
  const listError = listRetry.error;
  // Until a list arrives, and after a failure that left none, there are no
  // rows to count: never present that as "No jobs found".
  const listStatus: JobsListStatus =
    listError && !hasListData ? "error" : jobsResult ? "ready" : "loading";
  const jobs = listStatus === "ready" ? (jobsResult?.jobs ?? []) : [];
  const totalTasks =
    listStatus === "ready" ? (jobsResult?.totalTasks ?? 0) : 0;

  // The toolbar notes a failed summary, unless the list's own alert (the load
  // error in place of the table, or the refresh notice above the toolbar)
  // already gives the same reason: one outage fails both reads.
  const summaryErrorMessage = summaryError
    ? formatUserFacingErrorMessage(summaryError, summaryErrorFallback)
    : undefined;
  const toolbarSummaryError =
    summaryErrorMessage &&
    !(
      listError != null &&
      formatUserFacingErrorMessage(listError, "") === summaryErrorMessage
    )
      ? summaryErrorMessage
      : undefined;

  // Kill mutation
  const killMutation = useKillJob();

  // Derived data. The service list comes from the summary; keep the selected
  // service in it so the filter still names it when the summary failed.
  const availableServices = Object.keys(appSummary ?? {});
  if (serviceFilter !== "all" && !availableServices.includes(serviceFilter)) {
    availableServices.push(serviceFilter);
  }
  availableServices.sort();

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
  const handleSortChange = (next: DataTableSort) => {
    setListState({ sort: next, page: 1 });
  };
  const { columns, handleSort } = useJobsColumns(sort, handleSortChange);

  // Pagination
  const handlePrevious = () => {
    setListState({ page: Math.max(1, page - 1) });
    clearSelection();
  };

  const handleNext = () => {
    setListState({ page: page + 1 });
    clearSelection();
  };

  const handlePageChange = (nextPage: number) => {
    setListState({ page: nextPage });
    clearSelection();
  };

  // Return to page 1 when filters change
  const handleStatusFilterChange = (value: string) => {
    setListState({ status: value, page: 1 });
    clearSelection();
  };

  const handleServiceFilterChange = (value: string) => {
    setListState({ service: value, page: 1 });
    clearSelection();
  };

  const handleArchivedChange = (value: boolean) => {
    setListState({ includeArchived: value, page: 1 });
    clearSelection();
  };

  const handlePageSizeChange = (size: number) => {
    setListState({ pageSize: size, page: 1 });
    clearSelection();
  };

  const handleDateFilterChange = (
    from: Date | undefined,
    to: Date | undefined,
  ) => {
    setListState({
      dateFrom: from ? toLocalDateParam(from) : undefined,
      dateTo: to ? toLocalDateParam(to) : undefined,
      page: 1,
    });
    clearSelection();
  };

  // Row rendering & keyboard
  const handleDoubleClick = (job: JobListItem) => {
    const resultHref = getJobResultHref(job);
    if (resultHref) {
      router.push(resultHref);
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

          {listError && hasListData ? (
            <JobsRefreshError
              error={listError}
              retrying={listRetry.retrying}
              onRetry={listRetry.retry}
            />
          ) : null}

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
            onRefresh={listRetry.retry}
            isRefreshing={isFetching}
            statusSummary={statusSummary}
            summaryError={toolbarSummaryError}
            dataUpdatedAt={dataUpdatedAt}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFilterChange={handleDateFilterChange}
          />
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1">
          {listStatus === "error" ? (
            <JobsLoadError
              error={listError}
              retrying={listRetry.retrying}
              onRetry={listRetry.retry}
            />
          ) : (
            <DataTable<JobListItem>
              data={filteredJobs}
              columns={columns}
              defaultColumnOrder={defaultJobsColumnOrder}
              layoutKey="jobs"
              isLoading={listStatus === "loading"}
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
          )}
        </div>

        {/* Pagination */}
        <div className="shrink-0 border-t">
          <JobsPagination
            status={listStatus}
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
