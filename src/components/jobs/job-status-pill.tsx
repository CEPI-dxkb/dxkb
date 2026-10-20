"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  CirclePlay,
  Clock,
  Loader2,
} from "lucide-react";
import { cn, formatUserFacingErrorMessage } from "@/lib/utils";
import { useAuth } from "@/lib/auth/provider";
import { useJobsSummary } from "@/hooks/services/jobs/use-jobs-summary";
import { useJobsData } from "@/hooks/services/jobs/use-jobs-data";
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
import { statusConfig } from "@/lib/jobs/constants";
import { CirclePlaySpinner } from "@/lib/jobs/icons";
import {
  formatServiceName,
  getJobResultHref,
  getOutputFile,
} from "@/lib/jobs/formatting";

/** `formatUserFacingErrorMessage` fallback for a failed job summary read. */
const summaryErrorFallback = "The job service did not answer.";

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

  // While the session could not be verified, the job service may well reject
  // the token too: fetch once and then only when the user asks, rather than
  // polling a request that keeps failing.
  const polls = !isSessionUnverified;
  const summaryQuery = useJobsSummary(false, { poll: polls });
  const summary = summaryQuery.data;
  // A refetch of a summary that never loaded (a back-off poll or a Retry)
  // puts it back to pending. Keep its error, so the unavailable pill and its
  // open popover stay up until the refetch answers.
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
  const runningCount =
    (taskSummary["running"] ?? 0) + (taskSummary["in-progress"] ?? 0);
  const queuedCount =
    (taskSummary["queued"] ?? 0) + (taskSummary["pending"] ?? 0);
  const displayableCount = completedCount + runningCount + queuedCount;

  // Running and queued counts always show, so a zero reads as "nothing in
  // flight" rather than leaving the user to infer it from a missing icon.
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
  ].filter(({ count, alwaysShown }) => alwaysShown || count > 0);

  const activeRefetchInterval =
    runningCount > 0 || queuedCount > 0 ? 3_000 : 30_000;

  const { data: jobsResult, isPending } = useJobsData({
    offset: 0,
    limit: 5,
    includeArchived: false,
    sortField: "submit_time",
    sortOrder: "desc",
    refetchInterval: polls ? activeRefetchInterval : false,
    enabled: displayableCount > 0,
  });

  if (!isAuthenticated) return null;

  const closePopover = () => {
    setIsOpen(false);
  };
  const summaryErrorMessage = summaryRetry.error
    ? formatUserFacingErrorMessage(summaryRetry.error, summaryErrorFallback)
    : undefined;

  // A failed summary is not "no jobs": say the status is unavailable, and why.
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

  // First load: hold the pill's place rather than leaving the header without
  // one for as long as the job service takes to answer.
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
            aria-label="View job status"
          >
            {statusGroups.map(({ key, count, icon: Icon, className }) => (
              <span key={key} className="flex items-center gap-1">
                <Icon className={cn("size-3.5", className)} />
                <span className="text-sm">{count}</span>
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
