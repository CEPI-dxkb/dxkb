import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function GeoDistributionSkeleton() {
  return (
    <Card variant="panel" size="sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-36 rounded-md" />
          <Skeleton className="h-7 w-32 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <Skeleton className="h-140 rounded-md" />
        <div className="mt-3 flex justify-end">
          <Skeleton className="h-4 w-44" />
        </div>
      </CardContent>
    </Card>
  );
}
