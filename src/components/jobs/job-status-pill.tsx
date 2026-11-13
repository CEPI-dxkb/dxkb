"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  CirclePlay,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { cn, formatUserFacingErrorMessage, noop } from "@/lib/utils";
import { useAuth } from "@/lib/auth/provider";
import { useJobsTaskSummary } from "@/hooks/services/jobs/use-jobs-summary";
import {
  jobsDataQueryOptions,
  useJobsData,
} from "@/hooks/services/jobs/use-jobs-data";
import { useKeptQueryError } from "@/hooks/services/jobs/use-kept-query-error";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import {
  failedJobStatuses,
  queuedJobStatuses,
  runningJobStatuses,
  statusConfig,
  sumStatusCounts,
} from "@/lib/jobs/constants";
import { CirclePlaySpinner } from "@/lib/jobs/icons";
import {
  formatServiceName,
  getJobResultHref,
  getOutputFile,
} from "@/lib/jobs/formatting";

const summaryErrorFallback = "The job service did not answer.";

const recentJobsWarmMs = 10_000;

const recentJobsParams = {
  offset: 0,
  limit: 5,
  includeArchived: false,
  sortField: "submit_time",
  sortOrder: "desc",
} as const;

function MyJobsHeader({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex items-center justify-between border-b px-3 py-2">
      <PopoverTitle>My Jobs</PopoverTitle>
      <Link
        href="/jobs"
        className="text-xs font-medium text-link underline-offset-4 hover:underline"
        onClick={onNavigate}
      >
        View all →
      </Link>
    </div>
  );
}

export function JobStatusPill() {
  const { isAuthenticated, isSessionUnverified } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // While the session is unverified the job service may reject the token too: fetch once, then only
  // on request.
  const polls = !isSessionUnverified;
  const summaryQuery = useJobsTaskSummary(false, { poll: polls });
  const summary = summaryQuery.data;
  // A refetch of a summary that never loaded puts it back to pending; keep its error so the
  // unavailable pill stays up.
  const keptSummaryError = useKeptQueryError({
    error: summaryQuery.error,
    hasData: summary !== undefined,
  });
  const summaryRetry = useRetryKeepingError({
    error: keptSummaryError,
    isFetching: summaryQuery.isFetching,
    refetch: summaryQuery.refetch,
  });
  const taskSummary = summary?.taskSummary ?? {};

  const completedCount = taskSummary["completed"] ?? 0;
  const runningCount = sumStatusCounts(taskSummary, runningJobStatuses);
  const queuedCount = sumStatusCounts(taskSummary, queuedJobStatuses);
  const failedCount = sumStatusCounts(taskSummary, failedJobStatuses);
  const displayableCount =
    completedCount + runningCount + queuedCount + failedCount;

  const statusGroups = [
    {
      key: "queued",
      count: queuedCount,
      icon: Clock,
      className: "text-white/60",
      alwaysShown: true,
    },
    {
      key: "running",
      count: runningCount,
      icon: runningCount > 0 ? CirclePlaySpinner : CirclePlay,
      className: "text-accent",
      alwaysShown: true,
    },
    {
      key: "completed",
      count: completedCount,
      icon: CheckCircle2,
      className: "text-emerald-400",
      alwaysShown: false,
    },
    {
      key: "failed",
      count: failedCount,
      icon: XCircle,
      // `destructive` clashes with the blue navbar fill; this is a softer red.
      className: "text-destructive-inverse",
      alwaysShown: false,
    },
  ].filter(({ count, alwaysShown }) => alwaysShown || count > 0);

  const activeRefetchInterval =
    runningCount > 0 || queuedCount > 0 ? 3_000 : 30_000;

  const { data: jobsResult, isPending } = useJobsData({
    ...recentJobsParams,
    refetchInterval: polls ? activeRefetchInterval : false,
    enabled: isOpen && displayableCount > 0,
    staleTime: recentJobsWarmMs,
  });

  const warmRecentJobs = () => {
    // Base UI returns focus to the trigger after close, so a close may fire one extra read when the
    // list is >10 s old (accepted).
    if (isOpen) return;
    void queryClient
      .query({
        ...jobsDataQueryOptions(recentJobsParams),
        staleTime: recentJobsWarmMs,
      })
      .catch(noop);
  };

  if (!isAuthenticated) return null;

  const closePopover = () => {
    setIsOpen(false);
  };
  const summaryErrorMessage = summaryRetry.error
    ? formatUserFacingErrorMessage(summaryRetry.error, summaryErrorFallback)
    : undefined;

  if (summaryErrorMessage && !summary) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="inverse-outline"
              size="pill"
              aria-label="Job status unavailable"
              title={`Job status unavailable: ${summaryErrorMessage}`}
            >
              <CircleAlert className="size-3.5" />
              <span className="text-sm">Jobs</span>
            </Button>
          }
        />
        <PopoverContent
          size="flush"
          className="w-80"
          align="end"
          side="bottom"
          sideOffset={8}
        >
          <MyJobsHeader onNavigate={closePopover} />
          <div
            role="alert"
            className="grid justify-items-start gap-2 p-3"
          >
            <p className="text-sm text-destructive">
              <span className="font-medium">Job status unavailable: </span>
              {summaryErrorMessage}
            </p>
            <QueryRetryButton
              retrying={summaryRetry.retrying}
              onRetry={summaryRetry.retry}
            />
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  if (!summary) {
    return (
      <span
        role="status"
        aria-label="Loading job status"
        className={buttonVariants({ variant: "inverse-outline", size: "pill" })}
      >
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      </span>
    );
  }

  if (displayableCount === 0) return null;

  const jobs = jobsResult?.jobs ?? [];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="inverse-outline"
            size="pill"
            // Opens with the visible counts (WCAG 2.5.3), e.g. "0 1 1".
            aria-label={`${statusGroups.map(({ count }) => String(count)).join(" ")}, view job status`}
            onPointerEnter={warmRecentJobs}
            onFocus={warmRecentJobs}
          >
            {statusGroups.map(({ key, count, icon: Icon, className }) => (
              <span key={key} className="flex items-center gap-1">
                <Icon className={cn("size-3.5", className)} />
                <span className="text-sm">{count}</span>
                {" "}
              </span>
            ))}
          </Button>
        }
      />
      <PopoverContent
        size="flush"
        className="w-80"
        align="end"
        side="bottom"
        sideOffset={8}
      >
        <MyJobsHeader onNavigate={closePopover} />

        {summaryErrorMessage && (
          <div
            role="status"
            className="grid justify-items-start gap-2 border-b px-3 py-2"
          >
            <p className="text-xs text-muted-foreground">
              Could not refresh job status: {summaryErrorMessage} The counts
              are from the last update.
            </p>
            <QueryRetryButton
              retrying={summaryRetry.retrying}
              onRetry={summaryRetry.retry}
            />
          </div>
        )}

        <div className="divide-y">
          {isPending ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : jobs.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No recent jobs
            </p>
          ) : (
            jobs.map((job) => {
              const config = statusConfig[job.status];
              const Icon = config.icon;
              const serviceName = formatServiceName(job.app);
              const jobName = getOutputFile(job);
              const resultHref = getJobResultHref(job);
              const label = (
                <>
                  {serviceName}
                  {jobName && (
                    <span className="text-muted-foreground"> · {jobName}</span>
                  )}
                </>
              );
              const title = jobName ? `${serviceName} · ${jobName}` : serviceName;
              return (
                <div key={job.id} className="flex items-center gap-2 px-3 py-2">
                  <Icon className={cn("size-4 shrink-0", config.className)} />
                  {resultHref ? (
                    <Link
                      href={resultHref}
                      title={title}
                      className="min-w-0 truncate text-sm hover:underline"
                      onClick={() => {
                        setIsOpen(false);
                      }}
                    >
                      {label}
                    </Link>
                  ) : (
                    <span
                      title={title}
                      className="min-w-0 truncate text-sm"
                    >
                      {label}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
