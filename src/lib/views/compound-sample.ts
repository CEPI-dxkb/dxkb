import { eq, type DataResource } from "@/lib/data-api";
import type { ServerDataRepository } from "@/lib/data-api/repository";

interface CompoundSampleRecord {
  sample_identifier: string;
}

type CollectionRepository = Pick<ServerDataRepository, "collection">;

export type CompoundSampleLookup<TRecord extends CompoundSampleRecord> =
  | { status: "unique"; record: TRecord }
  | { status: "not-found" }
  | { status: "ambiguous"; discriminatorValues: string[] };

export async function resolveCompoundSample<
  TRecord extends CompoundSampleRecord,
>(
  repository: CollectionRepository,
  options: {
    resource: Extract<DataResource, "surveillance" | "serology">;
    sampleIdentifier: string;
    discriminatorField: "pathogen_test_type" | "test_type";
    discriminator?: string;
    parseRecord: (row: Record<string, unknown>) => TRecord;
  },
): Promise<CompoundSampleLookup<TRecord>> {
  const predicates = [
    eq(options.resource, "sample_identifier", options.sampleIdentifier),
  ];
  if (options.discriminator) {
    predicates.push(
      eq(options.resource, options.discriminatorField, options.discriminator),
    );
  }
  const result = await repository.collection(options.resource, {
    operation: "collection",
    rql:
      predicates.length === 1 ? predicates[0] : `and(${predicates.join(",")})`,
    page: 1,
    pageSize: 2,
    facets: [options.discriminatorField],
  });
  if (result.total === 0 || result.rows.length === 0)
    return { status: "not-found" };
  if (result.total === 1 && result.rows.length === 1)
    return { status: "unique", record: options.parseRecord(result.rows[0]) };
  const discriminatorValues = (result.facets[options.discriminatorField] ?? [])
    .filter(({ count }) => count === 1)
    .map(({ value }) => String(value))
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  return { status: "ambiguous", discriminatorValues };
}
