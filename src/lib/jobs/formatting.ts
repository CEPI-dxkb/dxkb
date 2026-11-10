import type { JobListItem } from "@/types/workspace";
import { encodeWorkspaceSegment } from "@/lib/services/workspace/path-utils";
import { activeJobStatuses, serviceNames } from "./constants";

const serviceNameMap = new Map<string, string>(
  serviceNames.map((entry) => [entry.value, entry.displayName]),
);

export function formatServiceName(app: string): string {
  if (!app) return "";
  const known = serviceNameMap.get(app);
  if (known) return known;
  return app
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

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
 * `undefined` when the job records no output location or is still active (the location is set at
 * submission, before any result exists).
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

// Hoisted: building an Intl object per call costs far more than formatting.
const unixTimestampFormat = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatUnixTimestamp(ts: number | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return "\u2014";
  const date = new Date(ts * 1000);
  // DateTimeFormat#format throws on an invalid date; toLocaleString did not.
  if (Number.isNaN(date.getTime())) return "Invalid Date";
  return unixTimestampFormat.format(date);
}
