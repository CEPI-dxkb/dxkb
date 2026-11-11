import { downloadFormats, type DownloadFormatId } from "@/lib/data-api/downloads";
import { cn } from "@/lib/utils";

export function FileTypeTag({ format }: { format: DownloadFormatId }) {
  const { tag, kind } = downloadFormats[format];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-4 w-9 shrink-0 items-center justify-center rounded-sm bg-current/10 font-mono text-3xs leading-none font-bold tracking-tight",
        kind === "sequence"
          ? "text-chart-3"
          : format === "xlsx"
            ? "text-success"
            : "text-primary dark:text-link",
      )}
    >
      {tag}
    </span>
  );
}
