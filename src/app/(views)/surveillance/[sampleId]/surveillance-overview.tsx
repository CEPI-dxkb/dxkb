import { OverviewSection, overviewGroupFields } from "@/components/views";
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

/**
 * Latitude and longitude are rendered as one combined "Coordinates" field
 * appended to the Collection section, so neither is collected on its own.
 */
const combinedCoordinateFields = new Set([
  "collection_latitude",
  "collection_longitude",
]);

interface SurveillanceOverviewProps {
  surveillance: SurveillanceViewRecord;
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
        const fields = overviewGroupFields({
          fields: surveillanceFields,
          group: sourceGroup,
          row: surveillance,
          dateFields,
          formatDate: formatSourceDate,
          exclude: combinedCoordinateFields,
        });
        if (title === "Collection" && coordinates) {
          fields.push({
            field: "coordinates",
            label: "Coordinates",
            value: coordinates,
          });
        }

        return <OverviewSection key={title} title={title} fields={fields} />;
      })}
    </div>
  );
}
