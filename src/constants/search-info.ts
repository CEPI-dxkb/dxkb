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
  tabs?: Readonly<Record<string, string>>;
  pickerOrder?: number;
  allTermOrder?: number;
}

export function searchHref(searchType: SearchType, query: string): string {
  if (searchType.route.status === "canonical") {
    const params = [
      `keyword=${encodeURIComponent(query)}`,
      ...Object.entries(searchType.route.params ?? {}).map(
        ([name, value]) => `${name}=${encodeURIComponent(value)}`,
      ),
    ];
    return `/${searchType.route.segment}?${params.join("&")}`;
  }
  return `/search?type=${searchType.id}&q=${encodeURIComponent(query)}`;
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
    route: { status: "legacy" },
    tabs: { taxonomy: "Taxa" },
    pickerOrder: 9,
    allTermOrder: 0,
  },
  {
    id: "genome",
    typeTitle: "Genomes",
    route: { status: "canonical", segment: viewRegistry.genome.segment },
    tabs: { genome: "Genomes" },
    pickerOrder: 1,
    allTermOrder: 1,
  },
  {
    id: "genome_amr",
    typeTitle: "AMR Phenotypes",
    route: { status: "legacy" },
    tabs: { genome_amr: "AMR Phenotypes" },
  },
  {
    id: "genome_sequence",
    typeTitle: "Genomic Sequences",
    route: { status: "legacy" },
    tabs: { genome_sequence: "Sequences" },
    allTermOrder: 14,
  },
  {
    id: "strain",
    typeTitle: "Strains",
    route: { status: "canonical", segment: viewRegistry.strain.segment },
    tabs: { strain: "Strains" },
    pickerOrder: 2,
    allTermOrder: 2,
  },
  {
    id: "genome_feature",
    typeTitle: "Features",
    route: { status: "canonical", segment: viewRegistry.feature.segment },
    tabs: { genome_feature: "Features" },
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
    id: "sp_gene",
    typeTitle: "Specialty Genes",
    route: { status: "legacy" },
    allTermOrder: 4,
  },
  {
    id: "protein_feature",
    typeTitle: "Domains and Motifs",
    route: {
      status: "canonical",
      segment: viewRegistry["domains-and-motifs"].segment,
    },
    tabs: { protein_feature: "Domains and Motifs" },
    pickerOrder: 4,
    allTermOrder: 5,
  },
  {
    id: "epitope",
    typeTitle: "Epitopes",
    route: {
      status: "canonical",
      segment: viewRegistry.epitope.segment,
    },
    tabs: { epitope: "Epitopes" },
    pickerOrder: 5,
    allTermOrder: 6,
  },
  {
    id: "protein_structure",
    typeTitle: "Protein Structures",
    route: {
      status: "canonical",
      segment: viewRegistry["protein-structure"].segment,
    },
    tabs: { protein_structure: "Protein Structures" },
    pickerOrder: 6,
    allTermOrder: 7,
  },
  {
    id: "pathway",
    typeTitle: "Pathways",
    route: { status: "legacy" },
    allTermOrder: 8,
  },
  {
    id: "subsystem",
    typeTitle: "Subsystems",
    route: { status: "legacy" },
    allTermOrder: 9,
  },
  {
    id: "surveillance",
    typeTitle: "Surveillance",
    route: {
      status: "canonical",
      segment: viewRegistry.surveillance.segment,
    },
    tabs: { surveillance: "Surveillance" },
    pickerOrder: 7,
    allTermOrder: 10,
  },
  {
    id: "serology",
    typeTitle: "Serology",
    route: { status: "canonical", segment: viewRegistry.serology.segment },
    tabs: { serology: "Serology" },
    pickerOrder: 8,
    allTermOrder: 11,
  },
  {
    id: "experiment",
    typeTitle: "Experiments",
    route: { status: "canonical", segment: viewRegistry.experiment.segment },
    tabs: { experiment: "Experiments" },
    pickerOrder: 10,
    allTermOrder: 12,
  },
  {
    id: "antibiotics",
    typeTitle: "Antibiotics",
    route: { status: "legacy" },
    allTermOrder: 13,
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

export const searchTabsByType: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = Object.fromEntries(
  searchDescriptors.flatMap((descriptor) =>
    descriptor.tabs ? [[descriptor.id, descriptor.tabs]] : [],
  ),
);

export const allTermSearchTypes = searchDescriptors
  .filter((descriptor) => descriptor.allTermOrder !== undefined)
  .toSorted((a, b) => (a.allTermOrder ?? 0) - (b.allTermOrder ?? 0));

export const labelsBySearchType: Readonly<Record<string, string>> =
  Object.fromEntries(
    allTermSearchTypes.map((descriptor) => [
      descriptor.id,
      descriptor.typeTitle,
    ]),
  );
