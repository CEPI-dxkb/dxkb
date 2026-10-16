import { downloadFormats, type DownloadFormatId } from "@/lib/data-api/downloads";
import { cn } from "@/lib/utils";

/**
 * The extension tag (`TXT`, `CSV`, `XLSX`, `FNA`, `FAA`) at the start of a
 * Download format row, coloured by what the file holds: tables in the primary
 * colour, Excel in green, sequences in a chart colour.
 */
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
            : "text-primary",
      )}
    >
      {tag}
    </span>
  );
}
