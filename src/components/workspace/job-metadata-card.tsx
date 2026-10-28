"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ClipboardCopy, Dna, Eye, FileText, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ServiceCollapsible,
  ServiceCollapsibleContent,
  ServiceCollapsibleTrigger,
} from "@/components/services/form-ui/service-collapsible";
import {
  formatElapsedSeconds,
  formatUnixTimestamp,
} from "@/lib/jobs/formatting";
import { cn } from "@/lib/utils";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";
import { genomeHref } from "@/lib/views/hrefs";
import { getProxyUrl } from "./file-viewer/file-viewer-registry";
import { findReportPath, reportAppIds } from "./workspace-job-action-bar";

interface JobMetadataCardProps {
  resolvedJobMeta: ResolvedPathObject;
  annotationGenomeId?: string | null;
  className?: string;
}

export function JobMetadataCard({
  resolvedJobMeta,
  annotationGenomeId,
  className,
}: JobMetadataCardProps) {
  const [parametersOpen, setParametersOpen] = useState(false);
  const router = useRouter();

  const meta = resolvedJobMeta.jobSysMeta;
  const isReportJob =
    (!!meta?.app?.id && reportAppIds.has(meta.app.id)) ||
    (meta?.output_files ?? []).some(
      (entry) => typeof entry[0] === "string" && entry[0].endsWith(".html"),
    );
  const reportPath = isReportJob ? findReportPath(resolvedJobMeta) : null;
  const reportUrl = reportPath ? getProxyUrl(reportPath) : null;
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
    <div className={cn("flex shrink-0 flex-col gap-2 rounded-md border border-border p-4", className)}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold">{title}</h2>
        {(annotationGenomeId ?? isReportJob) && (
          <TooltipProvider>
            <div className="flex shrink-0 gap-1">
              {annotationGenomeId && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { router.push(genomeHref(annotationGenomeId)); }}
                  >
                    <Eye className="size-4" />
                    View
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { router.push(`${genomeHref(annotationGenomeId)}?tab=features`); }}
                  >
                    <Dna className="size-4" />
                    CDS
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { router.push(`${genomeHref(annotationGenomeId)}?tab=genome-browser`); }}
                  >
                    <Globe className="size-4" />
                    Browser
                  </Button>
                </>
              )}
              {isReportJob && (
                reportUrl ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.open(reportUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <FileText className="size-4" />
                    Report
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex cursor-not-allowed">
                          <Button variant="secondary" size="sm" disabled>
                            <FileText className="size-4" />
                            Report
                          </Button>
                        </span>
                      }
                    />
                    <TooltipContent>
                      <p>Report file not found in job output</p>
                    </TooltipContent>
                  </Tooltip>
                )
              )}
            </div>
          </TooltipProvider>
        )}
      </div>
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

      <ServiceCollapsible
        open={parametersOpen}
        onOpenChange={setParametersOpen}
        className="p-1!"
      >
        <ServiceCollapsibleTrigger className="text-sm">
          {parametersOpen ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          Job Parameters
        </ServiceCollapsibleTrigger>
        <ServiceCollapsibleContent>
          <div className="relative mt-2">
            <Button
              type="button"
              variant="ghost-outline"
              className="absolute top-2 right-4 z-10 size-10"
              onClick={() => {
                const text = JSON.stringify(parameters, null, 2);
                void navigator.clipboard.writeText(text).then(
                  () => toast.success("Parameters copied to clipboard"),
                  () => toast.error("Failed to copy"),
                );
              }}
              title="Copy to clipboard"
            >
              <ClipboardCopy className="size-5" />
            </Button>
            <pre className="scrollbar-themed max-h-64 overflow-auto rounded bg-muted/50 p-2 pr-10 font-mono text-xs">
              {JSON.stringify(parameters, null, 2)}
            </pre>
          </div>
        </ServiceCollapsibleContent>
      </ServiceCollapsible>
    </div>
  );
}
