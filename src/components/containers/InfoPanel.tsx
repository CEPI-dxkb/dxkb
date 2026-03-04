import React, { useState } from "react";
import { useWorkspaceDu } from "@/hooks/services/workspace/use-workspace-du";

import { genomeFields } from "@/constants/datafields/genome";
import { genome_sequenceFields } from "@/constants/datafields/genome_sequence";
import { genome_amrFields } from "@/constants/datafields/genome_amr";
import { genome_featureFields } from "@/constants/datafields/genome_feature";
import { biosetFields } from "@/constants/datafields/bioset";
import { protein_featureFields } from "@/constants/datafields/protein_feature";
import { epitopeFields } from "@/constants/datafields/epitope";
import { experimentFields } from "@/constants/datafields/experiment";
import { protein_structureFields } from "@/constants/datafields/protein_structure";
import { serologyFields } from "@/constants/datafields/serology";
import { strainFields } from "@/constants/datafields/strain";
import { surveillanceFields } from "@/constants/datafields/surveillance";
import { taxonomyFields } from "@/constants/datafields/taxonomy";
import { Button } from "@/components/ui/button";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { WorkspaceItemIcon } from "@/components/workspace/workspace-item-icon";

import { ChevronRight, ChevronDown } from "lucide-react";

export type InfoPanelProps =
  | {
      variant: "workspace";
      /** When multiple items are selected, single-file details are not shown. */
      selection: WorkspaceBrowserItem[];
      onClose?: () => void;
      onAction?: (actionId: string, selection: WorkspaceBrowserItem[]) => void;
    }
  | {
      variant?: "search";
      rows: Record<string, unknown>[];
      activeTab: string;
    };

function formatWorkspaceDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatWorkspaceOwner(ownerId: string): string {
  if (!ownerId) return "—";
  return ownerId.replace(/@bvbrc$/, "");
}

function formatDiskUsage(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes < 1024 * 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
}

/** Build the full path to a workspace item (parent + name) for API calls like Workspace.du. */
function getItemFullPath(item: WorkspaceBrowserItem): string {
  const rawPath = (item.path ?? "").replace(/\/+$/, "").replace(/\/+/g, "/");
  const name = (item.name ?? "").trim();
  const segmentSuffix = `/${name}`;
  const nameAlreadyInPath = rawPath === name || rawPath.endsWith(segmentSuffix);
  const fullPath = (nameAlreadyInPath ? rawPath : `${rawPath}/${name}`).replace(/\/+/g, "/");
  const normalized = (fullPath || rawPath || item.path || "").trim();
  return normalized ? (normalized.startsWith("/") ? normalized : `/${normalized}`) : "";
}

function WorkspaceItemDetailContent({
  workspaceItem,
  onClose: _onClose,
  onAction: _onAction,
}: {
  workspaceItem: WorkspaceBrowserItem;
  onClose?: () => void;
  onAction?: (actionId: string, selection: WorkspaceBrowserItem[]) => void;
}) {
  const fullPath = getItemFullPath(workspaceItem);
  const pathDisplay = fullPath || workspaceItem.path || "—";

  const { data: diskUsage, isPending: isDiskUsageLoading, error: diskUsageError } = useWorkspaceDu(fullPath || null);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <h3 className="truncate text-sm font-semibold">{workspaceItem.name}</h3>
      </div>
      <div className="scrollbar-themed flex-1 overflow-y-auto py-3 text-xs">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <WorkspaceItemIcon type={workspaceItem.type} className="h-6 w-6" />
            <span className="font-medium capitalize text-muted-foreground">
              {workspaceItem.type || "—"}
            </span>
          </div>
          <dl className="grid gap-1.5">
            <div>
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="break-all">{formatWorkspaceOwner(workspaceItem.owner_id)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatWorkspaceDate(workspaceItem.creation_time)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Path</dt>
              <dd className="break-all font-mono text-[11px]">{pathDisplay}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground mb-1">Workspace Members</dt>
              <dd className="text-muted-foreground">
                {formatWorkspaceOwner(workspaceItem.owner_id)}
                {workspaceItem.user_permission === "o" ? " (me) – Owner" : " – Owner"}
              </dd>
            </div>
          </dl>
          <dl className="grid gap-1.5">
            <div>
              <dt className="text-muted-foreground mb-1">Disk Usage</dt>
              <dd className="text-muted-foreground">
                {isDiskUsageLoading
                  ? "Loading…"
                  : diskUsageError
                    ? "—"
                    : diskUsage !== undefined
                      ? formatDiskUsage(diskUsage.sizeBytes)
                      : "—"}
              </dd>
            </div>
            {diskUsage !== undefined && (
              <>
                <div>
                  <dt className="text-muted-foreground">Files</dt>
                  <dd className="text-muted-foreground">
                    {diskUsage.files.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Folders</dt>
                  <dd className="text-muted-foreground">
                    {diskUsage.folders.toLocaleString()}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

export function InfoPanel(props: InfoPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  if (props.variant === "workspace") {
    const { selection } = props;
    const isMultiSelect = selection.length > 1;
    const hasSingleSelection = selection.length === 1;

    return (
      <div className="flex h-full w-full flex-col overflow-hidden px-4 py-2">
        {isMultiSelect ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b pb-2">
              <h3 className="truncate text-sm font-semibold">
                {selection.length} items selected
              </h3>
            </div>
            <div className="text-muted-foreground flex flex-1 items-center justify-center py-6 text-center text-sm">
              Select a single item to view details
            </div>
          </>
        ) : hasSingleSelection ? (
          <WorkspaceItemDetailContent
            workspaceItem={selection[0]}
            onClose={props.onClose}
            onAction={props.onAction}
          />
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center py-6 text-center text-sm">
            Select an item to view details
          </div>
        )}
      </div>
    );
  }

  const { rows, activeTab } = props;
  let order: string[] = []; // default empty
  let fieldFile = {};
  let allowedFields: string[] = [];
  let panelTitleField = '';

  switch (activeTab) {
    case 'genome':
      panelTitleField = 'genome_name';
      fieldFile = genomeFields;
      allowedFields = ["genome_id", "genome_name", "other_names", "taxon_id", "superkingdom", "kingdom", "phylum", "class", "order", "family", "genus", "species", "genome_status", "strain", "serovar", "biovar", "pathovar", "mlst", "segment", "subtype", "h_type", "n_type", "h1_clade_gobal", "h1_clade_us", "h3_clade", "h5_clade", "ph1n1_like", "lineage", "clade", "subclade", "other_typing", "culture_collection", "type_strain", "reference_genome", "completion_date", "publication", "authors", "bioproject_accession", "biosample_accession", "assembly_accession", "sra_accession", "genbank_accessions", "sequencing_centers", "sequencing_status", "sequencing_platform", "sequencing_depth", "assembly_method", "chromosomes", "plasmids", "contigs", "genome_length", "gc_content", "contig_l50", "contig_n50", "trna", "rrna", "mat_peptide", "cds", "genome_quality", "coarse_consistency", "fine_consistency", "checkm_completeness", "checkm_contamination", "genome_quality_flags", "isolation_source", "isolation_comments", "collection_date", "collection_year", "season", "isolation_country", "state_province", "geographic_group", "geographic_location", "other_environmental", "host_name", "host_common_name", "host_gender", "host_age", "host_health", "host_group", "lab_host", "passage", "other_clinical", "additional_metadata", "comments", "date_inserted", "date_modified"];
      order = ["General Info","Taxonomy Info","Status","Type Info","DB Cross Reference","Sequence Info","Genome Statistics","Annotation Statistics","Genome Quality","Isolate Info","Host Info","Additional Info",];
      break;
    case 'genome_sequence':
      panelTitleField = 'sequence_id';
      fieldFile = genome_sequenceFields;
      allowedFields = ["genome_id", "genome_name", "taxon_id", "sequence_id", "accession", "sequence_status", "topology", "description", "gc_content", "length", "sequence_md5", "release_date", "version", "date_inserted", "date_modified"];
      order = ["General Info","Taxonomy Info", "Sequence Info", "Additional Info",];
      break;
    case 'genome_amr':
      fieldFile = genome_amrFields;
      allowedFields = ['taxon_id', 'genome_id', 'genome_name', 'antibiotic', 'evidence', 'pmid', 'resistant_phenotype', 'measurement_sign', 'measurement_value', 'measurement_unit', 'laboratory_typing_method', 'laboratory_typing_method_version', 'laboratory_typing_platform', 'vendor', 'testing_standard', 'testing_standard_year', 'computational_method', 'computational_method_version', 'computational_method_performance'];
      order = ["Summary","Measurement","Laboratory Method","Computational Method"];
      break;
    case 'genome_feature':
      panelTitleField = 'patric_id';
      fieldFile = genome_featureFields;
      allowedFields = ['genome_id', 'genome_name', 'taxon_id', 'sequence_id', 'accession', 'annotation', 'feature_type', 'feature_id', 'alt_locus_tag', 'patric_id', 'refseq_locus_tag', 'protein_id', 'gene_id', 'uniprotkb_accession', 'pdb_accession', 'start', 'end', 'strand', 'location', 'segments', 'Codon Start', 'na_length', 'aa_length', 'na_sequence_md5', 'aa_sequence_md5', 'gene', 'date_inserted', 'product', 'plfam_id','pgfam_id', 'sog_id', 'og_id', 'go','property', 'notes', 'classifier_score', 'classifier_round'];
      order = ['Genome','Source','Identifiers','DB Cross References','Location','Sequences','Annotation','Families','Misc','Provenance'];
      break;
    case 'strain':
      panelTitleField = 'strain';
      fieldFile = strainFields;
      allowedFields = ['taxon_id', 'family', 'genus', 'species', 'strain', 'subtype', 'h_type', 'n_type', 'genome_ids', 'genbank_accessions', 'segment_count', 'status', 'host_group', 'host_common_name', 'host_name', 'lab_host', 'passage', 'geographic_group', 'isolation_country', 'collection_year', 'collection_date', 'season', '1_pb2', '2_pb1', '3_pa', '4_ha', '5_np', '6_na', '7_mp', '8_ns', 's', 'm', 'l', 'other_segments', 'date_inserted'];
      order = ['Genome Info','Strain Info'];
      break;
    case 'protein_feature':
      panelTitleField = 'genome_id';
      fieldFile = protein_featureFields;
      allowedFields = ['genome_id', 'genome_name', 'taxon_id', 'patric_id', 'refseq_locus_tag', 'gene', 'product', 'interpro_id', 'interpro_description', 'feature_type', 'source', 'source_id', 'description', 'classification', 'score', 'e_value', 'evidence', 'publication', 'start', 'end', 'segments', 'length', 'sequence', 'comments', 'date_inserted'];
      order = ['Genome Info','Sequence Info','Feature Info','Additional Info'];
      break;
    case 'epitope':
      panelTitleField = 'epitope_id';
      fieldFile = epitopeFields;
      allowedFields = ['epitope_id', 'epitope_type', 'epitope_sequence', 'organism', 'taxon_id', 'protein_name', 'protein_id', 'protein_accession', 'start', 'end', 'host_name', 'total_assays', 'assay_results', 'bcell_assays', 'tcell_assays', 'mhc_assays', 'comments', 'date_inserted'];
      order = ['Epitope Info','Additional Info'];
      break;
    case 'protein_structure':
      panelTitleField = 'pdb_id';
      fieldFile = protein_structureFields;
      allowedFields = ['pdb_id', 'title', 'organism_name', 'taxon_id', 'genome_id', 'patric_id', 'uniprotkb_accession', 'gene', 'product', 'method', 'resolution', 'pmid', 'institution', 'authors', 'release_date', 'file_path', 'date_inserted'];
      order = ['General Info','Structure Info','Additional Info'];
      break;
    case 'surveillance':
      panelTitleField = 'sample_identifier';
      fieldFile = surveillanceFields;
      allowedFields = ['project_identifier', 'contributing_institution', 'sample_identifier', 'sample_accession','sample_material', 'sample_transport_medium', 'sample_receipt_date', 'longitudinal_study', 'embargo_end_date', 'collector_name', 'collector_institution', 'contact_email_address', 'collection_date', 'collection_year', 'collection_season', 'collection_country', 'collection_state_province', 'collection_city', 'collection_poi', 'collection_latitude', 'collection_longitude', 'geographic_group', 'pathogen_test_type', 'pathogen_test_interpretation', 'species', 'pathogen_type', 'subtype', 'strain', 'host_identifier', 'host_id_type', 'host_species', 'host_common_name', 'host_group', 'host_sex', 'host_age', 'host_habitat', 'host_natural_state', 'host_capture_status', 'host_health', 'exposure', 'duration_of_exposure', 'exposure_type', 'use_of_personal_protective_equipment', 'primary_living_situation', 'nursing_home_residence', 'daycare_attendance', 'travel_history', 'profession', 'pregnancy', 'trimester_of_pregnancy', 'breastfeeding', 'hospitalized','hospitalization_duration', 'intensive_care_unit', 'chest_imaging_interpretation', 'ventilation', 'oxygen_saturation', 'ecmo', 'dialysis', 'disease_status', 'days_elapsed_to_disease_status', 'tobacco_use', 'packs_per_day_for_how_many_years', 'chronic_conditions', 'maintenance_medication', 'types_of_allergies', 'influenza_like_illness_over_the_past_year', 'infections_within_five_years', 'human_leukocyte_antigens', 'symptoms', 'onset_hours', 'sudden_onset', 'diagnosis', 'pre_visit_medication', 'post_visit_medication', 'treatment_type', 'treatment', 'initiation_of_treatment', 'duration_of_treatment', 'treatment_dosage', 'vaccination_type', 'days_elapsed_to_vaccination', 'source_of_vaccine_information', 'vaccine_lot_number', 'vaccine_manufacturer', 'vaccine_dosage', 'other_vaccinations', 'additional_metadata', 'comments'];
      order = ['Sample Info','Sample Collection','Sample Tests','Host Info','Environmental Exposure','Clinical Data','Medical History','Symptoms/Diagnosis','Treatment','Vaccination','Other'];
      break;
    case 'serology':
      panelTitleField = 'sample_identifier';
      fieldFile = serologyFields;
      allowedFields = ['project_identifier', 'contributing_institution', 'sample_identifier', 'host_identifier', 'host_type', 'host_species', 'host_common_name', 'host_sex', 'host_age', 'host_age_group', 'host_health', 'collection_country', 'collection_state', 'collection_city', 'collection_date', 'collection_year', 'geographic_group', 'test_type', 'test_result', 'test_interpretation', 'serotype', 'comments'];
      order = ['Sample Info', 'Host Info', 'Sample Collection', 'Sample Tests', 'Other'];
      break;
    case 'taxonomy':
      panelTitleField = 'taxon_name';
      fieldFile = taxonomyFields;
      allowedFields = ['taxon_id', 'taxon_name', 'taxon_rank', 'other_names', 'genetic_code', 'lineage_names', 'parent_id', 'division', 'description', 'genomes'];
      order = ['Taxon Info'];
      break;
    case 'experiment':
      panelTitleField = 'exp_name'
      fieldFile = experimentFields;
      allowedFields = ['exp_id', 'study_name', 'study_title', 'study_description','study_pi','study_institution','exp_name', 'exp_title', 'exp_description', 'exp_poc', 'experimenters', 'public_repositories', 'public_identifier', 'exp_type', 'measurement_technique','organism', 'strain', 'treatment_type', 'treatment_name', 'treatment_amount', 'treatment_duration', 'samples', 'biosets', 'genome_id','additional_metadata'];
      order = ['Study Info', 'Experiment Info', 'Additional Metadata'];
      break;
    case 'bioset':
      panelTitleField = 'bioset_name';
      fieldFile = biosetFields;
      allowedFields = ['exp_id', 'exp_name', 'exp_title', 'exp_type', 'bioset_id', 'bioset_name', 'bioset_description', 'bioset_type', 'analysis_method', 'bioset_criter','result_type','protocol','bioset_result','organism', 'strain', 'treatment_type', 'treatment_name', 'treatment_amount', 'treatment_duration', 'entity_count', 'additonal_metadata'];
      order = ['Experiment Info', 'Bioset Info', 'Treatment', 'Additional Metadata'];
      break;
  }

  interface DisplayColumn {
    id: unknown;
    label: unknown;
    visible: boolean;
    group: unknown;
    link?: unknown;
    linkType?: unknown;
    linkText?: unknown;
  }
  const displayColumns: DisplayColumn[] = Object.values(fieldFile ?? {}).map((obj) => {
    const o = obj as Record<string, unknown>;
    return {
      id: o.field,
      label: o.label,
      visible: !o.hidden,
      group: o.group,
      link: o?.link,
      linkType: o?.linkType,
      linkText: o?.linkText,
    };
  });

  const effectiveExpanded = order.reduce(
    (acc, group) => {
      acc[group] = expandedGroups[group] ?? true;
      return acc;
    },
    { ...expandedGroups } as Record<string, boolean>
  );

  const grouped = displayColumns.reduce(
    (acc: Record<string, DisplayColumn[]>, item) => {
      const g = String(item.group ?? "");
      if (!acc[g]) acc[g] = [];
      acc[g].push(item);
      return acc;
    },
    {} as Record<string, DisplayColumn[]>
  );

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !(prev[group] ?? true),
    }));
  };

  function formatDate(value: string): string {
    const date = new Date(value);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  function resolveLink(template: string, row: Record<string, unknown>, fallbackField: string) {
    return template.replace(/{([^}]+)}/g, (_, key: string) => {
      const value = row[key] ?? row[fallbackField] ?? "";
      return encodeURIComponent(String(value));
    });
  }

  function toAbsoluteUrl(url: string): string {
    try {
      // If the URL is already absolute, return it unchanged
      new URL(url);
      return url;
    } catch {
      // If not, make it absolute using dxkb.org. This is necessary since React kept trying to recode the URL and it was messing stuff up but it won't mess with an absolute URL
      return new URL(url, 'https://www.dxkb.org').href;
    }
  }

//  console.log("Active Tab:", activeTab);
//  console.log("Panel Title Field:", panelTitleField);
//  console.log("Rows:", rows);
//  console.log("Order:", order);
//  console.log("Grouped Columns:", grouped);

  return (
    <div className="scrollbar-themed w-full p-4 overflow-y-auto text-xs">
      <div className="mb-2 text-secondary text-lg">
        {String(rows[0]?.[panelTitleField] ?? "")}
      </div>

      {rows.length === 1 ? (
        <table className="w-full text-left border-separate border-spacing-y-1">
          <tbody>
            {order.map((group) => {
              const items = (grouped[group] || []).filter((item) =>
                allowedFields.includes(String(item.id))
              );
              if (items.length === 0) return null;

              const isExpanded = effectiveExpanded[group] ?? true;
              const hasAtLeastOneValue = items.some(
                (item) => rows[0]?.[String(item.id)]
              );

              return (
                <React.Fragment key={group}>
                  <tr>
                    <th
                      colSpan={2}
                      onClick={() => toggleGroup(group)}
                      className="border-r border-l border-black bg-primary text-secondary p-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        {group}
                      </div>
                    </th>
                  </tr>
                  {isExpanded &&
                    (hasAtLeastOneValue ? (
                      items.map((item) => {
                        const fieldId = String(item.id);
                        const rawValue = rows[0]?.[fieldId];
                        if (
                          rawValue === undefined ||
                          rawValue === null ||
                          rawValue === ""
                        )
                          return null;

                        const value =
                          typeof rawValue === "string" &&
                          /^\d{4}-\d{2}-\d{2}T/.test(rawValue)
                            ? formatDate(rawValue)
                            : rawValue;

                        if (item.link) {
                          const resolved = resolveLink(String(item.link), rows[0], fieldId);
                          console.log(resolved);
                        }

                        return (
                          <tr key={fieldId}>
                            <td className="px-2 py-0.5 font-medium text-xs w-[40%] align-top">
                              {String(item.label)}
                            </td>
                            <td className="px-2 py-0.5 text-xs break-all align-top">
                              {item.link ? (() => {
                                  let resolved = resolveLink(String(item.link), rows[0], fieldId);
                                  console.log(resolved);
                                  resolved = toAbsoluteUrl(resolved);
                                  console.log(resolved);

                                  return item.linkType === "button" ? (
                                    <Button
                                      onClick={() => window.open(resolved, "_blank", "noopener,noreferrer")}
                                      className="text-sm border-black bg-primary text-secondary py-1 px-2 rounded"
                                    >
                                      {String(item.linkText ?? "View")}
                                    </Button>
                                  ) : (
                                    <a
                                      href={resolved}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 underline hover:text-blue-800"
                                    >
                                      {String(value)}
                                    </a>
                                  );
                                })() : String(value)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={2}
                          className="italic text-gray-500 px-2 py-1"
                        >
                          None available
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p>{rows.length} rows selected</p>
      )}
{/*
      <p>
      {JSON.stringify(rows[0])}
      </p>
*/}
    </div>
  );
}
