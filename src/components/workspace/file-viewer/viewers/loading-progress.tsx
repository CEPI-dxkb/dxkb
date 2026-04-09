import { formatFileSize } from "@/lib/services/workspace/helpers";

interface LoadingProgressProps {
  bytesLoaded: number;
  totalBytes: number | null;
}

export function LoadingProgress({
  bytesLoaded,
  totalBytes,
}: LoadingProgressProps) {
  const percentage =
    totalBytes && totalBytes > 0
      ? Math.min(100, Math.round((bytesLoaded / totalBytes) * 100))
      : null;

  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
      <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-150"
          style={{ width: percentage !== null ? `${percentage}%` : "100%" }}
        />
      </div>
      <span className="shrink-0 tabular-nums">
        {formatFileSize(bytesLoaded)}
        {totalBytes !== null ? ` / ${formatFileSize(totalBytes)}` : ""}
        {percentage !== null ? ` (${percentage}%)` : ""}
      </span>
    </div>
  );
}
