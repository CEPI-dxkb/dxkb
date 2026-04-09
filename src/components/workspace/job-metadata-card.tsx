"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  formatElapsedSeconds,
  formatUnixTimestamp,
} from "@/lib/jobs/formatting";
import { cn } from "@/lib/utils";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";

interface JobMetadataCardProps {
  resolvedJobMeta: ResolvedPathObject;
  className?: string;
}

export function JobMetadataCard({ resolvedJobMeta, className }: JobMetadataCardProps) {
  const [parametersOpen, setParametersOpen] = useState(false);

  const meta = resolvedJobMeta.jobSysMeta;
  const taskData = resolvedJobMeta.taskData;
  const jobId = meta?.id ?? taskData?.task_id ?? "—";
  const startTime = meta?.start_time ?? taskData?.start_time;
  const endTime = meta?.end_time ?? taskData?.end_time;
  const elapsed = meta?.elapsed_time ?? taskData?.elapsed_time;
  const appLabel =
    meta?.app?.label ?? taskData?.app_id ?? resolvedJobMeta.name;
  const parameters = meta?.parameters ?? {};
  const title = `${appLabel} Job Result`;

  return (
    <div className={cn("border-border flex shrink-0 flex-col gap-2 rounded-md border p-4", className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Job ID</dt>
          <dd className="font-mono text-xs">{jobId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Run time</dt>
          <dd>{formatElapsedSeconds(elapsed)}</dd>
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

      <Collapsible
        open={parametersOpen}
        onOpenChange={setParametersOpen}
        className="service-collapsible-container p-1!"
      >
        <CollapsibleTrigger className="service-collapsible-trigger text-sm">
          {parametersOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Job Parameters
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
            <pre className="scrollbar-themed bg-muted/50 max-h-64 overflow-auto rounded p-2 pr-10 font-mono text-xs">
              {JSON.stringify(parameters, null, 2)}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
