import { z } from "zod";

const identifier = z.union([z.string().min(1), z.number()]);
const scalar = z.union([z.string(), z.number(), z.boolean()]);
const stringList = z.union([z.string(), z.array(z.string())]);

export const surveillanceViewRecordSchema = z.looseObject({
  id: identifier,
  taxon_lineage_ids: z.union([scalar, z.array(scalar)]).optional(),
  sample_identifier: z.string().min(1),
  pathogen_test_type: z.array(z.string().min(1)).optional(),
  collection_date: z.string().optional(),
  sample_receipt_date: z.string().optional(),
  submission_date: z.string().optional(),
  collection_latitude: z.union([z.string(), z.number()]).optional(),
  collection_longitude: z.union([z.string(), z.number()]).optional(),
  pathogen_test_result: stringList.optional(),
  pathogen_test_interpretation: stringList.optional(),
  symptoms: stringList.optional(),
  diagnosis: stringList.optional(),
  comments: stringList.optional(),
  collection_year: scalar.optional(),
});

export type SurveillanceViewRecord = z.infer<
  typeof surveillanceViewRecordSchema
>;

export function isSurveillanceSampleId(value: string): boolean {
  return value.length > 0 && value.length <= 1_000;
}

export function formatSourceDate(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  if (!month) return year;
  if (!day) return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

export function formatCoordinates(
  latitude: string | number | null | undefined,
  longitude: string | number | null | undefined,
): string | null {
  const normalizedLatitude =
    typeof latitude === "string" ? latitude.trim() : latitude;
  const normalizedLongitude =
    typeof longitude === "string" ? longitude.trim() : longitude;
  if (
    normalizedLatitude == null ||
    normalizedLongitude == null ||
    normalizedLatitude === "" ||
    normalizedLongitude === ""
  ) {
    return null;
  }
  const lat = Number(normalizedLatitude);
  const lon = Number(normalizedLongitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }
  function coordinate(
    source: string | number,
    value: number,
    positive: string,
    negative: string,
  ) {
    const precision = String(source).trim().replace(/^[+-]/, "");
    return `${precision}° ${value < 0 ? negative : positive}`;
  }
  return `${coordinate(normalizedLatitude, lat, "N", "S")}, ${coordinate(normalizedLongitude, lon, "E", "W")}`;
}
