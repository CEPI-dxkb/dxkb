import { Skeleton } from "@/components/ui/skeleton";

export function TaxonomySummarySkeleton() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: 7 }).map((_, index) => (
        <Skeleton key={index} className="h-12 grow basis-32 rounded-md" />
      ))}
    </div>
  );
}
