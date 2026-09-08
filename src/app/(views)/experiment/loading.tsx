import { Skeleton } from "@/components/ui/skeleton";

export default function ExperimentLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pb-4" role="status" aria-label="Loading experiments">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="min-h-96 w-full flex-1" />
    </div>
  );
}
