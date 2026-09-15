import {
  OverviewCard,
  OverviewField,
  formatOverviewValue,
  isOverviewValueAvailable,
} from "@/components/views";
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

function displayValue(field: string, value: unknown): string | null {
  if (dateFields.has(field) && typeof value === "string" && value !== "")
    return formatSerologyDate(value);
  if (!isOverviewValueAvailable(value)) return null;
  return formatOverviewValue(value);
}

export function SerologyOverview({ serology }: SerologyOverviewProps) {
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      {sections.map(([title, sourceGroup]) => {
        const fields = Object.values(serologyFields).filter(
          ({ group }) => group === sourceGroup,
        );
        const values = fields.flatMap(({ field, label }) => {
          const value = displayValue(field, serology[field]);
          return value ? [{ field, label, value }] : [];
        });

        return (
          <OverviewCard key={title} title={title}>
            {values.length > 0 ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                {values.map(({ field, label, value }) => (
                  <OverviewField key={field} label={label} value={value} />
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No data available.
              </p>
            )}
          </OverviewCard>
        );
      })}
    </div>
  );
}
