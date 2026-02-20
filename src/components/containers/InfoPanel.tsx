import React, { useState, useEffect } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
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

export function InfoPanel({
  rows,
  activeTab,
}: {
  rows: any[];
  activeTab: string;
}) {

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

  const displayColumns = Object.values(fieldFile ?? {}).map((obj: any) => ({
    id: obj.field,
    label: obj.label,
    visible: !obj.hidden,
    group: obj.group,
    link: obj?.link,
    linkType: obj?.linkType,
    linkText: obj?.linkText
  }));

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () =>
      order.reduce((acc, group) => {
        acc[group] = true;
        return acc;
      }, {} as Record<string, boolean>)
  );

  const grouped = displayColumns.reduce(
    (acc: Record<string, typeof displayColumns>, item) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group].push(item);
      return acc;
    },
    {}
  );

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
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

  function resolveLink(template: string, row: any, fallbackField: string) {
    return template.replace(/{([^}]+)}/g, (_, key) => {
      const value = row[key] ?? row[fallbackField] ?? '';
      return encodeURIComponent(value);  // encode just the inserted value
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
    <div className="w-full p-4 overflow-y-auto text-xs">
      <div className="mb-2 text-secondary text-lg">
        {rows[0]?.[panelTitleField]}
      </div>

      {rows.length === 1 ? (
        <table className="w-full text-left border-separate border-spacing-y-1">
          <tbody>
            {order.map((group) => {
              const items = (grouped[group] || []).filter((item) =>
                allowedFields.includes(item.id)
              );
              if (items.length === 0) return null;

              const isExpanded = expandedGroups[group] ?? true;
              const hasAtLeastOneValue = items.some(
                (item) => rows[0]?.[item.id]
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
                        const rawValue = rows[0]?.[item.id];
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
                          const resolved = resolveLink(item.link, rows[0], item.id);
                          console.log(resolved);
                        }

                        return (
                          <tr key={item.id}>
                            <td className="px-2 py-0.5 font-medium text-xs w-[40%] align-top">
                              {item.label}
                            </td>
                            <td className="px-2 py-0.5 text-xs break-all align-top">
                              {item.link ? (() => {
                                  var resolved = resolveLink(item.link, rows[0], item.id);
                                  console.log(resolved);
                                  resolved = toAbsoluteUrl(resolved);
                                  console.log(resolved);

                                  return item.linkType === 'button' ? (
                                    <Button
                                      onClick={() => window.open(resolved, '_blank', 'noopener,noreferrer')}
                                      className="text-sm border-black bg-primary text-secondary py-1 px-2 rounded"
                                    >
                                      {item.linkText ?? 'View'}
                                    </Button>
                                  ) : (
                                    <a
                                      href={resolved}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 underline hover:text-blue-800"
                                    >
                                      {value}
                                    </a>
                                  );
                                })() : value}
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
