import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ReferenceGenomesSkeleton() {
  return (
    <Card variant="panel" className="xl:min-h-0 xl:flex-1" size="sm">
      <CardHeader className="pb-0">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="mt-2 h-8 w-full rounded-lg" />
      </CardHeader>
      <CardContent className="p-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
        <div className="flex h-80 flex-col gap-1 overflow-hidden xl:h-auto xl:min-h-0 xl:flex-1">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-8 shrink-0 rounded-sm" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
