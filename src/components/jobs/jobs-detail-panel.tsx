"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useJobOutput } from "@/hooks/services/jobs/use-job-detail";
import type { JobListItem } from "@/types/workspace";
import { formatDate } from "@/lib/services/workspace/helpers";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative h-6 w-6 p-0"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => { /* clipboard error ignored */ });
      }}
      title="Copy to clipboard"
    >
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
        <Copy
          className={`absolute h-3.5 w-3.5 transition-all duration-200 ${
            copied ? "scale-0 opacity-0" : "scale-100 opacity-100"
          }`}
        />
        <Check
          className={`absolute h-3.5 w-3.5 text-green-500 transition-all duration-200 ${
            copied ? "scale-100 opacity-100" : "scale-0 opacity-0"
          }`}
        />
      </span>
    </Button>
  );
}

function OutputSection({
  label,
  jobId,
  outputType,
}: {
  label: string;
  jobId: string;
  outputType: "stdout" | "stderr";
}) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, error } = useJobOutput(jobId, outputType, expanded);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className="border-t first:border-t-0">
      <div className="flex w-full items-center bg-muted/60 hover:bg-muted pr-2">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-xs font-semibold">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          {label}
        </CollapsibleTrigger>
        {data && <CopyButton text={data} />}
      </div>
      <CollapsibleContent>
        <div className="bg-muted/20 p-3">
          {isLoading ? (
            <p className="text-muted-foreground text-xs">Loading…</p>
          ) : error ? (
            <p className="text-destructive text-xs">Failed to load output</p>
          ) : data ? (
            <pre className="scrollbar-themed max-h-[32rem] overflow-auto whitespace-pre font-mono text-[10px] leading-relaxed">
              {data}
            </pre>
          ) : (
            <p className="text-muted-foreground text-xs italic">No output</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    error: "bg-red-100 text-red-800",
    running: "bg-blue-100 text-blue-800",
    "in-progress": "bg-blue-100 text-blue-800",
    queued: "bg-yellow-100 text-yellow-800",
    pending: "bg-gray-100 text-gray-600",
    cancelled: "bg-orange-100 text-orange-800",
  };
  const colors = colorMap[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${colors}`}>
      {status}
    </span>
  );
}

export function JobDetailsPanel({ job }: { job: JobListItem }) {
  const appLabel = job.app_spec?.label ?? job.app;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 pt-3 pb-3">
        <h3 className="truncate font-semibold">{job.id}</h3>
        <StatusBadge status={job.status} />
      </div>
      <div className="scrollbar-themed flex-1 overflow-y-auto px-4 py-3 text-sm">
        <div className="space-y-3">
          <dl className="grid gap-1.5">
            <div>
              <dt className="font-semibold">Service</dt>
              <dd className="break-all text-muted-foreground">{appLabel}</dd>
            </div>
            <div>
              <dt className="font-semibold">Application</dt>
              <dd className="break-all font-mono text-muted-foreground">{job.app}</dd>
            </div>
            <div>
              <dt className="font-semibold">Job ID</dt>
              <dd className="break-all font-mono text-muted-foreground">{job.id}</dd>
            </div>
            <div>
              <dt className="font-semibold">Submitted</dt>
              <dd className="text-muted-foreground">{formatDate(job.submit_time)}</dd>
            </div>
            {job.start_time && (
              <div>
                <dt className="font-semibold">Start</dt>
                <dd className="text-muted-foreground">{formatDate(job.start_time)}</dd>
              </div>
            )}
            {job.completed_time && (
              <div>
                <dt className="font-semibold">Completed</dt>
                <dd className="text-muted-foreground">{formatDate(job.completed_time)}</dd>
              </div>
            )}
            {job.output_path && (
              <div>
                <dt className="font-semibold">Output Path</dt>
                <dd className="break-all font-mono text-muted-foreground">{job.output_path}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="mt-3 overflow-hidden rounded-md border">
          <OutputSection label="Standard Output" jobId={job.id} outputType="stdout" />
          <OutputSection label="Error Output" jobId={job.id} outputType="stderr" />
        </div>
      </div>
    </div>
  );
}
