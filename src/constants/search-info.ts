import { normalizeLegacyKeyword } from "@/app/search/legacy-keyword-normalization";
import { encodeQueryComponent } from "@/lib/url";
import { viewRegistry } from "@/lib/views/view-registry";

export type SearchRoute =
  | { status: "legacy" }
  | {
      status: "canonical";
      segment: string;
      params?: Readonly<Record<string, string>>;
    };

export interface SearchType {
  id: string;
  typeTitle: string;
  route: SearchRoute;
  pickerOrder?: number;
  allTermOrder?: number;
}

/**
 * Where a search for `query` (text as typed) goes. A canonical list reads its
 * `?keyword=` as written, so the text goes there as legacy's search box reads
 * it (`normalizeLegacyKeyword`: `Rv0001` as the exact token `"Rv0001"`, `or`
 * as Solr's `OR`); `/search` normalizes its own `q`.
 */
export function searchHref(searchType: SearchType, query: string): string {
  if (searchType.route.status === "canonical") {
    const params = [
      `keyword=${encodeQueryComponent(normalizeLegacyKeyword(query))}`,
      ...Object.entries(searchType.route.params ?? {}).map(
        ([name, value]) => `${name}=${encodeQueryComponent(value)}`,
      ),
    ];
    return `/${searchType.route.segment}?${params.join("&")}`;
  }
  return `/search?type=${searchType.id}&q=${encodeQueryComponent(query)}`;
}

export const searchDescriptors: readonly SearchType[] = [
  {
    id: "everything",
    typeTitle: "All Data Types",
    route: { status: "legacy" },
    pickerOrder: 0,
  },
  {
    id: "taxonomy",
    typeTitle: "Taxa",
    route: { status: "canonical", segment: viewRegistry.taxonomy.segment },
    pickerOrder: 9,
    allTermOrder: 0,
  },
  {
    id: "genome",
    typeTitle: "Genomes",
    route: { status: "canonical", segment: viewRegistry.genome.segment },
    pickerOrder: 1,
    allTermOrder: 1,
  },
  {
    id: "strain",
    typeTitle: "Strains",
    route: { status: "canonical", segment: viewRegistry.strain.segment },
    pickerOrder: 2,
    allTermOrder: 2,
  },
  {
    id: "genome_feature",
    typeTitle: "Features",
    route: { status: "canonical", segment: viewRegistry.feature.segment },
    pickerOrder: 3,
    allTermOrder: 3,
  },
  {
    id: "protein",
    typeTitle: "Proteins",
    route: {
      status: "canonical",
      segment: viewRegistry.feature.segment,
      params: { filter: "protein" },
    },
  },
  {
    id: "protein_feature",
    typeTitle: "Domains and Motifs",
    route: {
      status: "canonical",
      segment: viewRegistry["domains-and-motifs"].segment,
    },
    pickerOrder: 4,
    allTermOrder: 4,
  },
  {
    id: "epitope",
    typeTitle: "Epitopes",
    route: {
      status: "canonical",
      segment: viewRegistry.epitope.segment,
    },
    pickerOrder: 5,
    allTermOrder: 5,
  },
  {
    id: "protein_structure",
    typeTitle: "Protein Structures",
    route: {
      status: "canonical",
      segment: viewRegistry["protein-structure"].segment,
    },
    pickerOrder: 6,
    allTermOrder: 6,
  },
  {
    id: "surveillance",
    typeTitle: "Surveillance",
    route: {
      status: "canonical",
      segment: viewRegistry.surveillance.segment,
    },
    pickerOrder: 7,
    allTermOrder: 7,
  },
  {
    id: "serology",
    typeTitle: "Serology",
    route: { status: "canonical", segment: viewRegistry.serology.segment },
    pickerOrder: 8,
    allTermOrder: 8,
  },
  {
    id: "experiment",
    typeTitle: "Experiments",
    route: { status: "canonical", segment: viewRegistry.experiment.segment },
    pickerOrder: 10,
    allTermOrder: 9,
  },
];

export function searchTypeForLocation(
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">,
): string | undefined {
  return searchDescriptors
    .filter(
      (descriptor) =>
        descriptor.route.status === "canonical" &&
        pathname === `/${descriptor.route.segment}`,
    )
    .toSorted((left, right) => {
      const leftParams =
        left.route.status === "canonical"
          ? Object.keys(left.route.params ?? {}).length
          : 0;
      const rightParams =
        right.route.status === "canonical"
          ? Object.keys(right.route.params ?? {}).length
          : 0;
      return rightParams - leftParams;
    })
    .find(
      (descriptor) =>
        descriptor.route.status === "canonical" &&
        Object.entries(descriptor.route.params ?? {}).every(
          ([name, value]) => searchParams.get(name) === value,
        ),
    )?.id;
}

export const searchTypes = searchDescriptors
  .filter((descriptor) => descriptor.pickerOrder !== undefined)
  .toSorted((a, b) => (a.pickerOrder ?? 0) - (b.pickerOrder ?? 0));

/**
 * The types the all-data-types page (`/search?type=everything`) searches, in
 * its order: only types with a DXKB list view, so every count links to one.
 */
export const allTermSearchTypes = searchDescriptors
  .filter((descriptor) => descriptor.allTermOrder !== undefined)
  .toSorted((a, b) => (a.allTermOrder ?? 0) - (b.allTermOrder ?? 0));
