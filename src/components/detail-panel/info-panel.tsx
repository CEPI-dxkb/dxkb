import { useWorkspaceDu } from "@/hooks/services/workspace/use-workspace-du";

import { genomeFields } from "@/constants/datafields/genome";
import { genomeSequenceFields } from "@/constants/datafields/genome_sequence";
import { genomeAmrFields } from "@/constants/datafields/genome_amr";
import { genomeFeatureFields } from "@/constants/datafields/genome_feature";
import { biosetFields } from "@/constants/datafields/bioset";
import { proteinFeatureFields } from "@/constants/datafields/protein_feature";
import { epitopeFields } from "@/constants/datafields/epitope";
import { experimentFields } from "@/constants/datafields/experiment";
import { proteinStructureFields } from "@/constants/datafields/protein_structure";
import { sequenceFeatureFields } from "@/constants/datafields/sequence_feature";
import { serologyFields } from "@/constants/datafields/serology";
import { strainFields } from "@/constants/datafields/strain";
import { surveillanceFields } from "@/constants/datafields/surveillance";
import { taxonomyFields } from "@/constants/datafields/taxonomy";
import { ppiFields } from "@/constants/datafields/ppi";
import type { DataFieldMap } from "@/constants/datafields/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DetailPanel, type DetailField } from "./index";
import { formatOwner, formatFileSize } from "@/lib/services/workspace/helpers";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { getItemFullPath } from "./info-panel-utils";
import { WorkspaceItemHeader } from "@/components/workspace/workspace-item-header";
import { WorkspaceItemDetails } from "@/components/workspace/workspace-item-details";

export type InfoPanelProps =
  | {
      variant: "workspace";
      /** When multiple items are selected, single-file details are not shown. */
      selection: WorkspaceItem[];
      onClose?: () => void;
      onAction?: (actionId: string, selection: WorkspaceItem[]) => void;
    }
  | {
      variant?: "search";
      selectedIds: string[];
      activeTab: string;
      selectedRow?: Record<string, unknown> | null;
      isLoading?: boolean;
      isAllPagesSelected?: boolean;
      totalItems?: number;
    };

function WorkspaceItemDetailContent({
  workspaceItem,
  onClose,
}: {
  workspaceItem: WorkspaceItem;
  onClose?: () => void;
  onAction?: (actionId: string, selection: WorkspaceItem[]) => void;
}) {
  const fullPath = getItemFullPath(workspaceItem);

  const {
    data: diskUsage,
    isPending: isDiskUsageLoading,
    error: diskUsageError,
  } = useWorkspaceDu(fullPath || null);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <WorkspaceItemHeader item={workspaceItem} onClose={onClose} />

      <WorkspaceItemDetails item={workspaceItem}>
        <div>
          <dt className="text-muted-foreground">Workspace Members</dt>
          <dd>
            {formatOwner(workspaceItem.ownerId ?? "")}
            {workspaceItem.permissions?.user === "o"
              ? " (me) – Owner"
              : " – Owner"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Disk Usage</dt>
          <dd>
            {isDiskUsageLoading
              ? "Loading…"
              : diskUsageError
                ? "—"
                : formatFileSize(diskUsage.sizeBytes, { showZero: true })}
          </dd>
        </div>
        {diskUsage !== undefined && (
          <>
            <div>
              <dt className="text-muted-foreground">Files</dt>
              <dd>{diskUsage.files.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Folders</dt>
              <dd>{diskUsage.folders.toLocaleString()}</dd>
            </div>
          </>
        )}
      </WorkspaceItemDetails>
    </div>
  );
}

export function InfoPanel(props: InfoPanelProps) {
  if (props.variant === "workspace") {
    const { selection } = props;
    const isMultiSelect = selection.length > 1;
    const hasSingleSelection = selection.length === 1;

    return (
      <div className="flex size-full flex-col overflow-hidden">
        {isMultiSelect ? (
          <div className="px-4 py-2">
            <DetailPanel.Header
              title={`${String(selection.length)} items selected`}
            />
            <DetailPanel.EmptyState message="Select a single item to view details" />
          </div>
        ) : hasSingleSelection ? (
          <WorkspaceItemDetailContent
            workspaceItem={selection[0]}
            onClose={props.onClose}
            onAction={props.onAction}
          />
        ) : (
          <div className="px-4 py-2">
            <DetailPanel.EmptyState message="Select an item to view details" />
          </div>
        )}
      </div>
    );
  }

  return renderSearchInfoPanel(props);
}

function renderSearchInfoPanel(
  props: Exclude<InfoPanelProps, { variant: "workspace" }>,
) {
  const { selectedIds, activeTab, selectedRow, isLoading } = props;

  if (selectedIds.length === 1 && isLoading) {
    return <div className="p-4 text-sm">Loading...</div>;
  }

  let order: string[] = [];
  let fieldFile: DataFieldMap = {};
  let allowedFields: string[] = [];
  let panelTitleField = "";

  switch (activeTab) {
    case "genome":
      panelTitleField = "genome_name";
      fieldFile = genomeFields;
      allowedFields = [
        "genome_id",
        "genome_name",
        "other_names",
        "taxon_id",
        "superkingdom",
        "kingdom",
        "phylum",
        "class",
        "order",
        "family",
        "genus",
        "species",
        "genome_status",
        "strain",
        "serovar",
        "biovar",
        "pathovar",
        "mlst",
        "segment",
        "subtype",
        "h_type",
        "n_type",
        "h1_clade_gobal",
        "h1_clade_us",
        "h3_clade",
        "h5_clade",
        "ph1n1_like",
        "lineage",
        "clade",
        "subclade",
        "other_typing",
        "culture_collection",
        "type_strain",
        "reference_genome",
        "completion_date",
        "publication",
        "authors",
        "bioproject_accession",
        "biosample_accession",
        "assembly_accession",
        "sra_accession",
        "genbank_accessions",
        "sequencing_centers",
        "sequencing_status",
        "sequencing_platform",
        "sequencing_depth",
        "assembly_method",
        "chromosomes",
        "plasmids",
        "contigs",
        "genome_length",
        "gc_content",
        "contig_l50",
        "contig_n50",
        "trna",
        "rrna",
        "mat_peptide",
        "cds",
        "genome_quality",
        "coarse_consistency",
        "fine_consistency",
        "checkm_completeness",
        "checkm_contamination",
        "genome_quality_flags",
        "isolation_source",
        "isolation_comments",
        "collection_date",
        "collection_year",
        "season",
        "isolation_country",
        "state_province",
        "geographic_group",
        "geographic_location",
        "other_environmental",
        "host_name",
        "host_common_name",
        "host_gender",
        "host_age",
        "host_health",
        "host_group",
        "lab_host",
        "passage",
        "other_clinical",
        "additional_metadata",
        "comments",
        "date_inserted",
        "date_modified",
      ];
      order = [
        "General Info",
        "Taxonomy Info",
        "Status",
        "Type Info",
        "DB Cross Reference",
        "Sequence Info",
        "Genome Statistics",
        "Annotation Statistics",
        "Genome Quality",
        "Isolate Info",
        "Host Info",
        "Additional Info",
      ];
      break;
    case "genome_sequence":
      panelTitleField = "sequence_id";
      fieldFile = genomeSequenceFields;
      allowedFields = [
        "genome_id",
        "genome_name",
        "taxon_id",
        "sequence_id",
        "accession",
        "sequence_status",
        "topology",
        "description",
        "gc_content",
        "length",
        "sequence_md5",
        "release_date",
        "version",
        "date_inserted",
        "date_modified",
      ];
      order = [
        "General Info",
        "Taxonomy Info",
        "Sequence Info",
        "Additional Info",
      ];
      break;
    case "genome_amr":
      fieldFile = genomeAmrFields;
      allowedFields = [
        "taxon_id",
        "genome_id",
        "genome_name",
        "antibiotic",
        "evidence",
        "pmid",
        "resistant_phenotype",
        "measurement_sign",
        "measurement_value",
        "measurement_unit",
        "laboratory_typing_method",
        "laboratory_typing_method_version",
        "laboratory_typing_platform",
        "vendor",
        "testing_standard",
        "testing_standard_year",
        "computational_method",
        "computational_method_version",
        "computational_method_performance",
      ];
      order = [
        "Summary",
        "Measurement",
        "Laboratory Method",
        "Computational Method",
      ];
      break;
    case "genome_feature":
      panelTitleField = "patric_id";
      fieldFile = genomeFeatureFields;
      allowedFields = [
        "genome_id",
        "genome_name",
        "taxon_id",
        "sequence_id",
        "accession",
        "annotation",
        "feature_type",
        "feature_id",
        "alt_locus_tag",
        "patric_id",
        "refseq_locus_tag",
        "protein_id",
        "gene_id",
        "uniprotkb_accession",
        "pdb_accession",
        "start",
        "end",
        "strand",
        "location",
        "segments",
        "codon_start",
        "na_length",
        "aa_length",
        "na_sequence_md5",
        "aa_sequence_md5",
        "gene",
        "date_inserted",
        "product",
        "plfam_id",
        "pgfam_id",
        "sog_id",
        "og_id",
        "go",
        "property",
        "notes",
        "classifier_score",
        "classifier_round",
      ];
      order = [
        "Genome",
        "Source",
        "Identifiers",
        "DB Cross References",
        "Location",
        "Sequences",
        "Annotation",
        "Families",
        "Misc",
        "Provenance",
      ];
      break;
    case "strain":
      panelTitleField = "strain";
      fieldFile = strainFields;
      allowedFields = [
        "taxon_id",
        "family",
        "genus",
        "species",
        "strain",
        "subtype",
        "h_type",
        "n_type",
        "genome_ids",
        "genbank_accessions",
        "segment_count",
        "status",
        "host_group",
        "host_common_name",
        "host_name",
        "lab_host",
        "passage",
        "geographic_group",
        "isolation_country",
        "collection_year",
        "collection_date",
        "season",
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
        "date_inserted",
      ];
      order = ["Genome Info", "Strain Info"];
      break;
    case "protein_feature":
      panelTitleField = "genome_id";
      fieldFile = proteinFeatureFields;
      allowedFields = [
        "genome_id",
        "genome_name",
        "taxon_id",
        "patric_id",
        "refseq_locus_tag",
        "gene",
        "product",
        "interpro_id",
        "interpro_description",
        "feature_type",
        "source",
        "source_id",
        "description",
        "classification",
        "score",
        "e_value",
        "evidence",
        "publication",
        "start",
        "end",
        "segments",
        "length",
        "sequence",
        "comments",
        "date_inserted",
      ];
      order = [
        "Genome Info",
        "Sequence Info",
        "Feature Info",
        "Additional Info",
      ];
      break;
    case "epitope":
      panelTitleField = "epitope_id";
      fieldFile = epitopeFields;
      allowedFields = [
        "epitope_id",
        "epitope_type",
        "epitope_sequence",
        "organism",
        "taxon_id",
        "protein_name",
        "protein_id",
        "protein_accession",
        "start",
        "end",
        "host_name",
        "total_assays",
        "assay_results",
        "bcell_assays",
        "tcell_assays",
        "mhc_assays",
        "comments",
        "date_inserted",
      ];
      order = ["Epitope Info", "Additional Info"];
      break;
    case "protein_structure":
      panelTitleField = "pdb_id";
      fieldFile = proteinStructureFields;
      allowedFields = [
        "pdb_id",
        "title",
        "organism_name",
        "taxon_id",
        "genome_id",
        "patric_id",
        "uniprotkb_accession",
        "gene",
        "product",
        "method",
        "resolution",
        "pmid",
        "institution",
        "authors",
        "release_date",
        "file_path",
        "date_inserted",
      ];
      order = ["General Info", "Structure Info", "Additional Info"];
      break;
    case "surveillance":
      panelTitleField = "sample_identifier";
      fieldFile = surveillanceFields;
      allowedFields = [
        "project_identifier",
        "contributing_institution",
        "sample_identifier",
        "sample_accession",
        "sample_material",
        "sample_transport_medium",
        "sample_receipt_date",
        "longitudinal_study",
        "embargo_end_date",
        "collector_name",
        "collector_institution",
        "contact_email_address",
        "collection_date",
        "collection_year",
        "collection_season",
        "collection_country",
        "collection_state_province",
        "collection_city",
        "collection_poi",
        "collection_latitude",
        "collection_longitude",
        "geographic_group",
        "pathogen_test_type",
        "pathogen_test_interpretation",
        "species",
        "pathogen_type",
        "subtype",
        "strain",
        "host_identifier",
        "host_id_type",
        "host_species",
        "host_common_name",
        "host_group",
        "host_sex",
        "host_age",
        "host_habitat",
        "host_natural_state",
        "host_capture_status",
        "host_health",
        "exposure",
        "duration_of_exposure",
        "exposure_type",
        "use_of_personal_protective_equipment",
        "primary_living_situation",
        "nursing_home_residence",
        "daycare_attendance",
        "travel_history",
        "profession",
        "pregnancy",
        "trimester_of_pregnancy",
        "breastfeeding",
        "hospitalized",
        "hospitalization_duration",
        "intensive_care_unit",
        "chest_imaging_interpretation",
        "ventilation",
        "oxygen_saturation",
        "ecmo",
        "dialysis",
        "disease_status",
        "days_elapsed_to_disease_status",
        "tobacco_use",
        "packs_per_day_for_how_many_years",
        "chronic_conditions",
        "maintenance_medication",
        "types_of_allergies",
        "influenza_like_illness_over_the_past_year",
        "infections_within_five_years",
        "human_leukocyte_antigens",
        "symptoms",
        "onset_hours",
        "sudden_onset",
        "diagnosis",
        "pre_visit_medication",
        "post_visit_medication",
        "treatment_type",
        "treatment",
        "initiation_of_treatment",
        "duration_of_treatment",
        "treatment_dosage",
        "vaccination_type",
        "days_elapsed_to_vaccination",
        "source_of_vaccine_information",
        "vaccine_lot_number",
        "vaccine_manufacturer",
        "vaccine_dosage",
        "other_vaccinations",
        "additional_metadata",
        "comments",
      ];
      order = [
        "Sample Info",
        "Sample Collection",
        "Sample Tests",
        "Host Info",
        "Environmental Exposure",
        "Clinical Data",
        "Medical History",
        "Symptoms/Diagnosis",
        "Treatment",
        "Vaccination",
        "Other",
      ];
      break;
    case "serology":
      panelTitleField = "sample_identifier";
      fieldFile = serologyFields;
      allowedFields = [
        "project_identifier",
        "contributing_institution",
        "sample_identifier",
        "host_identifier",
        "host_type",
        "host_species",
        "host_common_name",
        "host_sex",
        "host_age",
        "host_age_group",
        "host_health",
        "collection_country",
        "collection_state",
        "collection_city",
        "collection_date",
        "collection_year",
        "geographic_group",
        "test_type",
        "test_result",
        "test_interpretation",
        "serotype",
        "comments",
      ];
      order = [
        "Sample Info",
        "Host Info",
        "Sample Collection",
        "Sample Tests",
        "Other",
      ];
      break;
    case "ppi":
      panelTitleField = "interactor_a";
      fieldFile = ppiFields;
      allowedFields = [
        "genome_id_a",
        "genome_name_a",
        "interactor_a",
        "interactor_type_a",
        "feature_id_a",
        "refseq_locus_tag_a",
        "gene_a",
        "interactor_desc_a",
        "taxon_id_a",
        "genome_id_b",
        "genome_name_b",
        "interactor_b",
        "interactor_type_b",
        "feature_id_b",
        "refseq_locus_tag_b",
        "gene_b",
        "interactor_desc_b",
        "taxon_id_b",
        "category",
        "interaction_type",
        "detection_method",
        "evidence",
        "pubmed",
        "score",
        "source_db",
        "domain_a",
        "domain_b",
        "date_inserted",
        "date_modified",
      ];
      order = ["Interactor A", "Interactor B", "Interaction", "Other"];
      break;
    case "taxonomy":
      panelTitleField = "taxon_name";
      fieldFile = taxonomyFields;
      allowedFields = [
        "taxon_id",
        "taxon_name",
        "taxon_rank",
        "other_names",
        "genetic_code",
        "lineage_names",
        "parent_id",
        "division",
        "description",
        "genomes",
      ];
      order = ["Taxon Info"];
      break;
    case "experiment":
      panelTitleField = "exp_name";
      fieldFile = experimentFields;
      allowedFields = [
        "exp_id",
        "study_name",
        "study_title",
        "study_description",
        "study_pi",
        "study_institution",
        "exp_name",
        "exp_title",
        "exp_description",
        "exp_poc",
        "experimenters",
        "public_repository",
        "public_identifier",
        "exp_type",
        "measurement_technique",
        "organism",
        "strain",
        "treatment_type",
        "treatment_name",
        "treatment_amount",
        "treatment_duration",
        "samples",
        "biosets",
        "genome_id",
        "additional_metadata",
      ];
      order = ["Study Info", "Experiment Info", "Additional Metadata"];
      break;
    case "bioset":
      panelTitleField = "bioset_name";
      fieldFile = biosetFields;
      allowedFields = [
        "exp_id",
        "exp_name",
        "exp_title",
        "exp_type",
        "bioset_id",
        "bioset_name",
        "bioset_description",
        "bioset_type",
        "analysis_method",
        "bioset_criteria",
        "result_type",
        "protocol",
        "bioset_result",
        "organism",
        "strain",
        "treatment_type",
        "treatment_name",
        "treatment_amount",
        "treatment_duration",
        "entity_count",
        "additional_metadata",
      ];
      order = [
        "Experiment Info",
        "Bioset Info",
        "Treatment",
        "Additional Metadata",
      ];
      break;
    case "sequence_feature":
      panelTitleField = "sf_name";
      fieldFile = sequenceFeatureFields;
      allowedFields = [
        "sf_name",
        "sf_id",
        "gene",
        "length",
        "variant_types",
        "sf_category",
        "segments",
        "source_strain",
        "product",
        "evidence_code",
        "source",
        "additional_metadata",
        "segment",
        "subtype",
        "comments",
      ];
      order = ["Sequence Feature", "Variant Type"];
      break;
  }

  interface DisplayColumn {
    id: string;
    label: string;
    visible: boolean;
    group: string;
    link?: string;
    linkType?: string;
    linkText?: string;
  }
  const allowedFieldIds = new Set(allowedFields);
  const strainAccessionFields = new Set([
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
  ]);
  const displayColumns: DisplayColumn[] = Object.values(fieldFile).map((o) => ({
    id: o.field,
    label: o.label,
    visible: !o.hidden,
    group: o.group,
    link:
      o.link ??
      (activeTab === "strain" && strainAccessionFields.has(o.field)
        ? "https://www.ncbi.nlm.nih.gov/nuccore/{value}"
        : undefined),
    linkType: o.linkType,
    linkText: o.linkText,
  }));

  const grouped = displayColumns.reduce<
    Record<string, DisplayColumn[] | undefined>
  >((acc: Record<string, DisplayColumn[] | undefined>, item) => {
    const g = (item.group as string | undefined) ?? "";
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  function resolveLink(
    template: string,
    row: Record<string, unknown>,
    fallbackField: string,
  ) {
    return template.replace(/{([^}]+)}/g, (_, key: string) => {
      const value = row[key] ?? row[fallbackField] ?? "";
      const primitive =
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
          ? value
          : "";
      return encodeURIComponent(String(primitive));
    });
  }

  function toAbsoluteUrl(url: string): string {
    try {
      new URL(url);
      return url;
    } catch {
      return new URL(url, "https://www.dxkb.org").href;
    }
  }

  return (
    <DetailPanel>
      {selectedIds.length === 1 ? (
        <>
          <DetailPanel.Header
            title={(selectedRow?.[panelTitleField] as string | undefined) ?? ""}
          />
          {order.map((group) => {
            const items = (grouped[group] || []).filter((item) =>
              allowedFieldIds.has(item.id),
            );
            if (items.length === 0) return null;

            const fields: DetailField[] = items.map((item) => {
              const fieldId = item.id;
              const rawValue = selectedRow?.[fieldId];
              if (item.link) {
                const resolved = toAbsoluteUrl(
                  resolveLink(item.link, selectedRow ?? {}, fieldId),
                );

                if (item.linkType === "button") {
                  return {
                    label: item.label,
                    value: rawValue,
                    render: () => (
                      <Button
                        onClick={() =>
                          window.open(resolved, "_blank", "noopener,noreferrer")
                        }
                        className="rounded border-black bg-primary px-2 py-1 text-sm text-secondary"
                      >
                        {item.linkText ?? "View"}
                      </Button>
                    ),
                  };
                }

                const linkTemplate = item.link;
                if (linkTemplate && Array.isArray(rawValue)) {
                  const values = rawValue.filter(
                    function isLinkValue(
                      value,
                    ): value is string | number | boolean {
                      return (
                        typeof value === "string" ||
                        typeof value === "number" ||
                        typeof value === "boolean"
                      );
                    },
                  );
                  return {
                    label: item.label,
                    value: rawValue,
                    render: function renderArrayLinks() {
                      return (
                        <span className="flex flex-wrap gap-x-2 gap-y-1">
                          {values.map(function renderLink(value, index) {
                            const href = resolveLink(
                              linkTemplate,
                              { ...selectedRow, [fieldId]: value },
                              fieldId,
                            );
                            const isExternal = /^https?:\/\//.test(href);
                            return isExternal ? (
                              <a
                                key={`${String(value)}-${String(index)}`}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline hover:text-blue-800"
                              >
                                {String(value)}
                              </a>
                            ) : (
                              <Link
                                key={`${String(value)}-${String(index)}`}
                                href={href}
                                className="text-blue-600 underline hover:text-blue-800"
                              >
                                {String(value)}
                              </Link>
                            );
                          })}
                        </span>
                      );
                    },
                  };
                }

                return {
                  label: item.label,
                  value: rawValue,
                  href: resolved,
                };
              }

              return {
                label: item.label,
                value: rawValue,
              };
            });

            return (
              <DetailPanel.CollapsibleSection
                key={group}
                label={group}
                variant="primary"
              >
                <DetailPanel.KeyValueTable fields={fields} />
              </DetailPanel.CollapsibleSection>
            );
          })}
        </>
      ) : (
        <p className="truncate px-3 py-2 text-sm font-semibold">
          {props.isAllPagesSelected && props.totalItems
            ? `All ${props.totalItems.toLocaleString()} rows selected`
            : `${String(selectedIds.length)} rows selected`}
        </p>
      )}
    </DetailPanel>
  );
}
