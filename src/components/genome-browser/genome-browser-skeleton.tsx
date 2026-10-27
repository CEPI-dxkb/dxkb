import { Skeleton } from "@/components/ui/skeleton";

export function GenomeBrowserSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 p-4"
      role="status"
      aria-label="Loading Genome Browser"
    >
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
