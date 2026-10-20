import DBStatisticsShell from "@/components/statistics/db-statistics-shell";
import {
  dbStatisticsDefinitions,
  fetchDbStatistics,
  type StatisticDefinition,
} from "@/lib/services/statistics";

const numberFormatter = new Intl.NumberFormat("en-US");

interface StatisticCardProps {
  definition: StatisticDefinition;
  count: number | null;
}

const StatisticCard = ({ definition, count }: StatisticCardProps) => {
  const displayValue = count === null ? "—" : numberFormatter.format(count);
  return (
    <div>
      <div className="mb-2 text-4xl font-bold">{displayValue}</div>
      <div>{definition.label}</div>
    </div>
  );
};

const DBStatistics = async () => {
  const { counts, unavailableReason } = await fetchDbStatistics();

  // Every count failed: one line saying so, with the cause, rather than eight
  // unexplained dashes. A single failed count keeps its own "—".
  if (unavailableReason !== null) {
    return (
      <DBStatisticsShell>
        <p role="alert" className="col-span-full text-sm">
          {unavailableReason
            ? `Statistics temporarily unavailable: ${unavailableReason}`
            : "Statistics temporarily unavailable."}
        </p>
      </DBStatisticsShell>
    );
  }

  return (
    <DBStatisticsShell>
      {dbStatisticsDefinitions.map((definition) => (
        <StatisticCard
          key={definition.key}
          definition={definition}
          count={counts[definition.key]}
        />
      ))}
    </DBStatisticsShell>
  );
};

export default DBStatistics;
