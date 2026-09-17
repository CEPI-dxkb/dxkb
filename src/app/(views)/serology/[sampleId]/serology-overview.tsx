import { OverviewSection, overviewGroupFields } from "@/components/views";
import { serologyFields } from "@/constants/datafields/serology";
import {
  formatSerologyDate,
  type SerologyViewRecord,
} from "@/lib/serology-view";

const sections = [
  ["Sample Info", "Sample Info"],
  ["Host", "Host Info"],
  ["Collection", "Sample Collection"],
  ["Tests", "Sample Tests"],
  ["Other", "Other"],
] as const;

const dateFields = new Set([
  "collection_date",
  "date_inserted",
  "date_modified",
]);

interface SerologyOverviewProps {
  serology: SerologyViewRecord;
}

export function SerologyOverview({ serology }: SerologyOverviewProps) {
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      {sections.map(([title, sourceGroup]) => (
        <OverviewSection
          key={title}
          title={title}
          fields={overviewGroupFields({
            fields: serologyFields,
            group: sourceGroup,
            row: serology,
            dateFields,
            formatDate: formatSerologyDate,
          })}
        />
      ))}
    </div>
  );
}
