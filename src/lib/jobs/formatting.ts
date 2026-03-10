import type { JobListItem } from "@/types/workspace";
import { SERVICE_NAMES } from "./constants";

const serviceNameMap = new Map<string, string>(
  SERVICE_NAMES.map((entry) => [entry.value, entry.displayName]),
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

export function getOutputName(job: JobListItem): string {
  const outputFile =
    job.output_file ?? String(job.parameters?.output_file ?? "");
  if (outputFile) return outputFile;
  return "\u2014";
}

export function formatElapsedSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m${s}s` : `${s}s`;
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
