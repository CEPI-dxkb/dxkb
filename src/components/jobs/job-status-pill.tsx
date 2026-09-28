"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/provider";
import { useJobsSummary } from "@/hooks/services/jobs/use-jobs-summary";
import { useJobsData } from "@/hooks/services/jobs/use-jobs-data";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { statusConfig } from "@/lib/jobs/constants";
import { formatServiceName, formatElapsedSeconds } from "@/lib/jobs/formatting";
import type { JobListItem } from "@/types/workspace";

function formatJobTime(job: JobListItem): string {
  if (
    job.elapsed_time != null &&
    Number.isFinite(job.elapsed_time) &&
    job.elapsed_time >= 0
  ) {
    return formatElapsedSeconds(job.elapsed_time);
  }
  if (job.completed_time) {
    const secondsAgo = Math.max(
      0,
      Math.floor((Date.now() - new Date(job.completed_time).getTime()) / 1000),
    );
    if (secondsAgo < 60) return "just now";
    if (secondsAgo < 3600) return `${String(Math.floor(secondsAgo / 60))}m ago`;
    if (secondsAgo < 86400)
      return `${String(Math.floor(secondsAgo / 3600))}h ago`;
    return `${String(Math.floor(secondsAgo / 86400))}d ago`;
  }
  return "";
}

export function JobStatusPill() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const { data: summary } = useJobsSummary(false);
  const taskSummary = summary?.taskSummary ?? {};

  const completedCount = taskSummary["completed"] ?? 0;
  const runningCount =
    (taskSummary["running"] ?? 0) + (taskSummary["in-progress"] ?? 0);
  const queuedCount =
    (taskSummary["queued"] ?? 0) + (taskSummary["pending"] ?? 0);
  const displayableCount = completedCount + runningCount + queuedCount;

  const statusGroups = [
    {
      key: "completed",
      count: completedCount,
      icon: CheckCircle2,
      className: "text-emerald-400",
    },
    {
      key: "running",
      count: runningCount,
      icon: Loader2,
      className: "text-blue-300 animate-spin",
    },
    {
      key: "queued",
      count: queuedCount,
      icon: Clock,
      className: "text-white/60",
    },
  ].filter(({ count }) => count > 0);

  const activeRefetchInterval =
    runningCount > 0 || queuedCount > 0 ? 3_000 : 30_000;

  const { data: jobsResult, isPending } = useJobsData({
    offset: 0,
    limit: 5,
    includeArchived: false,
    sortField: "submit_time",
    sortOrder: "desc",
    refetchInterval: activeRefetchInterval,
    enabled: displayableCount > 0,
  });

  if (!isAuthenticated || displayableCount === 0) return null;

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
        className="w-72"
        align="end"
        side="bottom"
        sideOffset={8}
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <PopoverTitle>My Jobs</PopoverTitle>
          <Link
            href="/jobs"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            View all →
          </Link>
        </div>

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
              return (
                <div key={job.id} className="flex items-center gap-2 px-3 py-2">
                  <Icon className={cn("size-4 shrink-0", config.className)} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {formatServiceName(job.app)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatJobTime(job)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
