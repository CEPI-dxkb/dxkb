import type { JobListItem } from "@/types/workspace";
import { encodeWorkspaceSegment } from "@/lib/services/workspace/path-utils";
import { activeJobStatuses, serviceNames } from "./constants";

const serviceNameMap = new Map<string, string>(
  serviceNames.map((entry) => [entry.value, entry.displayName]),
);

/** Look up a human-readable display name for a service, falling back to regex formatting for unknown services. */
export function formatServiceName(app: string): string {
  if (!app) return "";
  const known = serviceNameMap.get(app);
  if (known) return known;
  return app
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

/** The job's output name, read from the job or, failing that, its submitted parameters. */
export function getOutputFile(job: JobListItem): string {
  return (
    job.output_file ?? ((job.parameters.output_file as string | undefined) ?? "")
  );
}

export function getOutputName(job: JobListItem): string {
  const outputFile = getOutputFile(job);
  if (outputFile) return outputFile;
  return "\u2014";
}

/**
 * Workspace URL of a job's result (`/workspace/<output_path>/<output_file>`),
 * or `undefined` when the job records no output location or is still active.
 * The location is set at submission, so a queued or running job has one before
 * any result exists there.
 */
export function getJobResultHref(job: JobListItem): string | undefined {
  if (activeJobStatuses.includes(job.status)) return undefined;
  const outputPath =
    job.output_path ?? ((job.parameters.output_path as string | undefined) ?? "");
  const outputFile = getOutputFile(job);
  if (!outputPath || !outputFile) return undefined;

  const segments = `${outputPath}/${outputFile}`
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);
  return `/workspace/${segments.map(encodeWorkspaceSegment).join("/")}`;
}

export function formatElapsedSeconds(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "\u2014";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${String(m)}m${String(s)}s` : `${String(s)}s`;
}

export function formatUnixTimestamp(ts: number | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return "\u2014";
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
