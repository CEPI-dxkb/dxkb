import DBStatisticsShell from "@/components/statistics/db-statistics-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { dbStatisticsDefinitions } from "@/lib/services/statistics";

const DBStatisticsSkeleton = () => {
  return (
    <DBStatisticsShell>
      {dbStatisticsDefinitions.map((definition) => (
        <div key={definition.key} data-testid="db-statistics-skeleton-cell">
          <Skeleton variant="inverse" className="mx-auto mb-2 h-10 w-24" />
          <Skeleton variant="inverse" className="mx-auto h-4 w-28" />
        </div>
      ))}
    </DBStatisticsShell>
  );
};

export default DBStatisticsSkeleton;
