/** Genome metadata fields the tree services offer; a field's id is what the job's `metadata_fields` carries. */

export interface MetadataField {
  id: string;
  name: string;
  selected: boolean;
}

export interface MetadataFieldOption {
  value: string;
  label: string;
}

export interface MetadataFieldSection {
  label: string;
  options: MetadataFieldOption[];
}

/** The table legacy starts with (`GeneTree.js` `startupMetadataTable`). */
export const defaultMetadataFields: MetadataField[] = [
  { id: "genome_id", name: "Genome ID", selected: true },
  { id: "genome_name", name: "Genome Name", selected: true },
  { id: "species", name: "Species", selected: true },
  { id: "strain", name: "Strain", selected: true },
  { id: "accession", name: "Accession", selected: true },
  { id: "subtype", name: "Subtype", selected: true },
];

/** Sections omit the frequent fields: an id is a Select item's value and React key, and a repeat broke both. */
const sectionFields: { label: string; fields: string[] }[] = [
  {
    label: "Frequent Fields",
    fields: [
      "genome_name",
      "genome_length",
      "feature_group",
      "species",
      "strain",
      "accession",
      "subtype",
      "lineage",
      "host_group",
      "host_common_name",
      "collection_date",
      "collection_year",
      "geographic_group",
      "isolation_country",
      "geographic_location",
    ],
  },
  { label: "General Info", fields: ["public", "genome_id", "other_name"] },
  {
    label: "Taxonomy",
    fields: [
      "taxon_id",
      "taxon_lineage_ids",
      "taxon_lineage_names",
      "superkingdom",
      "kingdom",
      "phylum",
      "class",
      "order",
      "family",
      "genus",
    ],
  },
  { label: "Status", fields: ["genome_status"] },
  {
    label: "Type Info",
    fields: [
      "serovar",
      "biovar",
      "pathovar",
      "mlst",
      "segment",
      "h_type",
      "n_type",
      "h1_clade_global",
      "h1_clade_us",
      "h3_clade",
      "h5_clade",
      "ph1n1_like",
      "clade",
      "subclade",
      "other_typing",
      "culture_collection",
      "type_strain",
      "reference_genome",
    ],
  },
  {
    label: "DB Cross Ref",
    fields: [
      "completion_date",
      "publication",
      "authors",
      "bioproject_accession",
      "biosample_accession",
      "assembly_accession",
      "sra_accession",
      "genbank_accessions",
    ],
  },
  {
    label: "Sequence Info",
    fields: [
      "sequencing_centers",
      "sequencing_platform",
      "sequencing_depth",
      "assembly_method",
    ],
  },
  {
    label: "Genome Statistics",
    fields: [
      "chromosomes",
      "plasmids",
      "contigs",
      "gc_content",
      "contig_l50",
      "contig_n50",
    ],
  },
  {
    label: "Genome Quality",
    fields: [
      "coarse_consistency",
      "fine_consistency",
      "checkm_completeness",
      "checkm_contamination",
      "genome_quality_flags",
      "genome_quality",
      "nearest_genomes",
      "outgroup_genomes",
    ],
  },
  {
    label: "Isolate Info",
    fields: [
      "isolation_source",
      "isolation_comments",
      "season",
      "state_province",
    ],
  },
  {
    label: "Host Info",
    fields: [
      "host_name",
      "host_gender",
      "host_age",
      "host_health",
      "lab_host",
      "passage",
      "other_clinical",
    ],
  },
  {
    label: "Additional Info",
    fields: [
      "additional_metadata",
      "comments",
      "date_inserted",
      "date_modified",
    ],
  },
];

const displayNames = new Map([["host_gender", "Host Sex"]]);

export function formatMetadataLabel(field: string): string {
  return field
    .replace(/_/g, " ")
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export const metadataFieldSections: MetadataFieldSection[] = sectionFields.map(
  ({ label, fields }) => ({
    label,
    options: fields.map((value) => ({
      value,
      label: displayNames.get(value) ?? formatMetadataLabel(value),
    })),
  }),
);

export const metadataFieldOptions: MetadataFieldOption[] =
  metadataFieldSections.flatMap((section) => section.options);

export function createMetadataField(fieldId: string): MetadataField {
  const option = metadataFieldOptions.find(({ value }) => value === fieldId);
  return {
    id: fieldId,
    name: option?.label ?? formatMetadataLabel(fieldId),
    selected: true,
  };
}

const optionValues = new Set(metadataFieldOptions.map(({ value }) => value));

function idList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];
}

/** The metadata table a job ran with; only genome fields are taken from `feature_metadata_fields`. */
export function metadataFieldIdsFromJob(
  params: Record<string, unknown>,
): string[] {
  const misfiledGenomeFields = idList(params.feature_metadata_fields).filter(
    (id) => optionValues.has(id),
  );
  return [
    ...new Set([
      ...idList(params.genome_metadata_fields),
      ...idList(params.metadata_fields),
      ...misfiledGenomeFields,
    ]),
  ];
}

export function availableMetadataFieldSections(
  selectedIds: ReadonlySet<string>,
): MetadataFieldSection[] {
  return metadataFieldSections.flatMap((section) => {
    const options = section.options.filter(
      ({ value }) => !selectedIds.has(value),
    );
    return options.length > 0 ? [{ ...section, options }] : [];
  });
}
