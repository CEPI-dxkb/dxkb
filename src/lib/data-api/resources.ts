import type { DataFieldMap } from "@/constants/datafields/types";
import { biosetFields } from "@/constants/datafields/bioset";
import { epitopeFields } from "@/constants/datafields/epitope";
import { epitopeAssayFields } from "@/constants/datafields/epitope_assay";
import { experimentFields } from "@/constants/datafields/experiment";
import { genomeFields } from "@/constants/datafields/genome";
import { genomeFeatureFields } from "@/constants/datafields/genome_feature";
import { genomeSequenceFields } from "@/constants/datafields/genome_sequence";
import { ppiFields } from "@/constants/datafields/ppi";
import { proteinFeatureFields } from "@/constants/datafields/protein_feature";
import { proteinStructureFields } from "@/constants/datafields/protein_structure";
import { serologyFields } from "@/constants/datafields/serology";
import { strainFields } from "@/constants/datafields/strain";
import { surveillanceFields } from "@/constants/datafields/surveillance";
import {
  biosetRecordSchema,
  epitopeAssayRecordSchema,
  epitopeRecordSchema,
  experimentRecordSchema,
  genomeFeatureRecordSchema,
  genomeRecordSchema,
  genomeSequenceRecordSchema,
  ppiRecordSchema,
  proteinFeatureRecordSchema,
  proteinStructureRecordSchema,
  serologyRecordSchema,
  strainRecordSchema,
  surveillanceRecordSchema,
} from "./schemas";
import type {
  DataResource,
  FieldType,
  ResourceDefinition,
  ResourceField,
  RqlFieldOperator,
} from "./types";

const ids: Record<DataResource, string> = {
  genome: "genome_id",
  genome_feature: "feature_id",
  epitope: "epitope_id",
  epitope_assay: "assay_id",
  surveillance: "id",
  serology: "id",
  strain: "id",
  protein_feature: "id",
  protein_structure: "pdb_id",
  experiment: "exp_id",
  bioset: "bioset_id",
  genome_sequence: "sequence_id",
  ppi: "id",
};

const alternateIdentifiers: Partial<Record<DataResource, readonly string[]>> = {
  genome_feature: ["patric_id"],
  surveillance: ["sample_identifier", "pathogen_test_type"],
  serology: ["sample_identifier", "test_type"],
};

const sourceFields: Partial<Record<DataResource, DataFieldMap>> = {
  genome: genomeFields,
  genome_feature: genomeFeatureFields,
  epitope: epitopeFields,
  epitope_assay: epitopeAssayFields,
  surveillance: surveillanceFields,
  serology: serologyFields,
  strain: strainFields,
  protein_feature: proteinFeatureFields,
  protein_structure: proteinStructureFields,
  experiment: experimentFields,
  bioset: biosetFields,
  genome_sequence: genomeSequenceFields,
  ppi: ppiFields,
};

const numericFields = new Set([
  "taxon_id",
  "taxon_id_a",
  "taxon_id_b",
  "genome_length",
  "contigs",
  "patric_cds",
  "collection_year",
  "start",
  "end",
  "length",
  "na_length",
  "aa_length",
  "gc_content",
  "segment_count",
  "entity_count",
  "classifier_score",
  "score",
  "resolution",
  "collection_latitude",
  "collection_longitude",
  "host_age",
  "sequencing_depth",
  "total_assays",
  "samples",
  "biosets",
  "bcell_assays",
  "tcell_assays",
  "mhc_assays",
]);
const booleanFields = new Set(["public", "reference_genome"]);
const dateFields = new Set([
  "date_created",
  "date_inserted",
  "date_modified",
  "date_updated",
  "collection_date",
  "completion_date",
  "embargo_end_date",
  "last_update_date",
  "release_date",
  "sample_receipt_date",
  "submission_date",
]);
const phraseFields = new Set(["strain", "pathogen_test_type"]);
const multipleFields: Partial<Record<DataResource, ReadonlySet<string>>> = {
  epitope: new Set(["assay_results", "host_name", "taxon_lineage_ids"]),
  surveillance: new Set(["pathogen_test_type", "taxon_lineage_ids"]),
  serology: new Set(["taxon_lineage_ids"]),
  experiment: new Set([
    "organism",
    "strain",
    "taxon_id",
    "taxon_lineage_ids",
    "genome_id",
    "treatment_type",
    "treatment_name",
    "treatment_amount",
    "treatment_duration",
  ]),
  protein_structure: new Set([
    "organism_name",
    "taxon_id",
    "taxon_lineage_ids",
    "taxon_lineage_names",
    "uniprotkb_accession",
    "gene",
    "product",
    "sequence_md5",
    "method",
    "pmid",
    "institution",
    "authors",
  ]),
  strain: new Set([
    "taxon_lineage_ids",
    "taxon_lineage_names",
    "genome_ids",
    "genbank_accessions",
    "1_pb2",
    "2_pb1",
    "3_pa",
    "4_ha",
    "5_np",
    "6_na",
    "7_mp",
    "8_ns",
    "s",
    "m",
    "l",
    "other_segments",
  ]),
};
const equalityOperators = ["eq", "ne", "in"] as const;
const orderedOperators = [
  ...equalityOperators,
  "lt",
  "le",
  "gt",
  "ge",
] as const satisfies readonly RqlFieldOperator[];

const schemas: Record<DataResource, ResourceDefinition["schema"]> = {
  genome: genomeRecordSchema,
  genome_feature: genomeFeatureRecordSchema,
  epitope: epitopeRecordSchema,
  epitope_assay: epitopeAssayRecordSchema,
  surveillance: surveillanceRecordSchema,
  serology: serologyRecordSchema,
  strain: strainRecordSchema,
  protein_feature: proteinFeatureRecordSchema,
  protein_structure: proteinStructureRecordSchema,
  experiment: experimentRecordSchema,
  bioset: biosetRecordSchema,
  genome_sequence: genomeSequenceRecordSchema,
  ppi: ppiRecordSchema,
};

function inferType(name: string): FieldType {
  if (numericFields.has(name) || name.endsWith("_count")) return "number";
  if (booleanFields.has(name)) return "boolean";
  if (dateFields.has(name) || name.endsWith("_date")) return "date";
  return "string";
}

function buildFields(resource: DataResource): Record<string, ResourceField> {
  const source = sourceFields[resource];
  const names = Object.values(source ?? {}).map((field) => field.field);
  names.push(ids[resource]);

  return Object.fromEntries(
    [...new Set(names)].map((name) => {
      const metadata = source
        ? Object.values(source).find((field) => field.field === name)
        : undefined;
      return [
        name,
        {
          type: inferType(name),
          cardinality: multipleFields[resource]?.has(name)
            ? "multiple"
            : "scalar",
          selectable: true,
          sortable:
            !multipleFields[resource]?.has(name) &&
            metadata?.sortable !== false,
          facet: metadata?.facet === true,
          quote:
            resource === "serology" && name === "test_type"
              ? "never"
              : phraseFields.has(name)
                ? "always"
                : "auto",
          operators: ["number", "date"].includes(inferType(name))
            ? orderedOperators
            : equalityOperators,
        } satisfies ResourceField,
      ];
    }),
  );
}

export const resourceRegistry = Object.fromEntries(
  (Object.keys(ids) as DataResource[]).map((resource) => [
    resource,
    {
      idField: ids[resource],
      identifierFields: [
        ids[resource],
        ...(alternateIdentifiers[resource] ?? []),
      ],
      fields: buildFields(resource),
      schema: schemas[resource],
    },
  ]),
) as unknown as Record<DataResource, ResourceDefinition>;

export function isDataResource(value: string): value is DataResource {
  return Object.hasOwn(resourceRegistry, value);
}

export function getResourceDefinition(resource: string): ResourceDefinition {
  if (!isDataResource(resource)) {
    throw new DataApiValidationError(`Unsupported data resource: ${resource}`);
  }
  return resourceRegistry[resource];
}

export class DataApiValidationError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "DataApiValidationError";
  }
}
