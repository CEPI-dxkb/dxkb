import {
  OverviewCard,
  OverviewField,
  formatOverviewValue,
  isOverviewValueAvailable,
} from "@/components/views";
import { surveillanceFields } from "@/constants/datafields/surveillance";
import {
  formatCoordinates,
  formatSourceDate,
  type SurveillanceViewRecord,
} from "@/lib/surveillance-view";

const sections = [
  ["Sample Info", "Sample Info"],
  ["Collection", "Sample Collection"],
  ["Tests", "Sample Tests"],
  ["Host", "Host Info"],
  ["Environmental Exposure", "Environmental Exposure"],
  ["Clinical Data", "Clinical Data"],
  ["Symptoms/Diagnosis", "Symptoms/Diagnosis"],
  ["Treatment", "Treatment"],
  ["Vaccination", "Vaccination"],
  ["Other", "Other"],
] as const;

const dateFields = new Set([
  "collection_date",
  "sample_receipt_date",
  "submission_date",
  "last_update_date",
  "embargo_end_date",
  "date_inserted",
  "date_updated",
]);

interface SurveillanceOverviewProps {
  surveillance: SurveillanceViewRecord;
}

function displayValue(field: string, value: unknown): string | null {
  if (dateFields.has(field) && typeof value === "string" && value !== "")
    return formatSourceDate(value);
  if (!isOverviewValueAvailable(value)) return null;
  return formatOverviewValue(value);
}

export function SurveillanceOverview({
  surveillance,
}: SurveillanceOverviewProps) {
  const coordinates = formatCoordinates(
    surveillance.collection_latitude,
    surveillance.collection_longitude,
  );

  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      {sections.map(([title, sourceGroup]) => {
        const fields = Object.values(surveillanceFields).filter(
          ({ group, field }) =>
            group === sourceGroup &&
            field !== "collection_latitude" &&
            field !== "collection_longitude",
        );
        const values = fields.flatMap(({ field, label }) => {
          const value = displayValue(field, surveillance[field]);
          return value ? [{ field, label, value }] : [];
        });
        if (title === "Collection" && coordinates) {
          values.push({
            field: "coordinates",
            label: "Coordinates",
            value: coordinates,
          });
        }

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
