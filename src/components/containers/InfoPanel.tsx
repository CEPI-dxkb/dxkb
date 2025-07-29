import React, { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { genomeFields } from "@/constants/datafields/genomes";
import { sequenceFields } from "@/constants/datafields/sequence";
import { amrphenotypeFields } from "@/constants/datafields/amrphenotypes";
import { featureFields } from "@/constants/datafields/features";
import { biosetFields } from "@/constants/datafields/biosets";
import { domainsandmotifsFields } from "@/constants/datafields/domainsandmotifs";
import { epitopeFields } from "@/constants/datafields/epitopes";
import { experimentFields } from "@/constants/datafields/experiments";
import { proteinstructureFields } from "@/constants/datafields/proteinstructures";
import { serologyFields } from "@/constants/datafields/serology";
import { strainsFields } from "@/constants/datafields/strains";
import { surveillanceFields } from "@/constants/datafields/surveillance";
import { taxaFields } from "@/constants/datafields/taxa";

export function InfoPanel({
  rows,
  activeTab,
}: {
  rows: any[];
  activeTab: string;
}) {

  var displayColumns;
  var allowedFields;
  var order;
  var fieldFile;

  switch (activeTab) {
    case 'genomes':
      fieldFile = genomeFields;
      allowedFields = ["genome_id", "genome_name", "other_names", "taxon_id", "superkingdom", "kingdom", "phylum", "class", "order", "family", "genus", "species", "genome_status", "strain", "serovar", "biovar", "pathovar", "mlst", "segment", "subtype", "h_type", "n_type", "h1_clade_gobal", "h1_clade_us", "h3_clade", "h5_clade", "ph1n1_like", "lineage", "clade", "subclade", "other_typing", "culture_collection", "type_strain", "reference_genome", "completion_date", "publication", "authors", "bioproject_accession", "biosample_accession", "assembly_accession", "sra_accession", "genbank_accessions", "sequencing_centers", "sequencing_status", "sequencing_platform", "sequencing_depth", "assembly_method", "chromosomes", "plasmids", "contigs", "genome_length", "gc_content", "contig_l50", "contig_n50", "trna", "rrna", "mat_peptide", "cds", "genome_quality", "coarse_consistency", "fine_consistency", "checkm_completeness", "checkm_contamination", "genome_quality_flags", "isolation_source", "isolation_comments", "collection_date", "collection_year", "season", "isolation_country", "state_province", "geographic_group", "geographic_location", "other_environmental", "host_name", "host_common_name", "host_gender", "host_age", "host_health", "host_group", "lab_host", "passage", "other_clinical", "additional_metadata", "comments", "date_inserted", "date_modified"];
      order = ["General Info","Taxonomy Info","Status","Type Info","DB Cross Reference","Sequence Info","Genome Statistics","Annotation Statistics","Genome Quality","Isolate Info","Host Info","Additional Info",];
      break;
    case 'sequences':
      fieldFile = sequenceFields;
      allowedFields = ["genome_id", "genome_name", "taxon_id", "sequence_id", "accession", "sequence_status", "topology", "description", "gc_content", "length", "sequence_md5", "release_date", "version", "date_inserted", "date_modified"];
      order = ["General Info","Taxonomy Info", "Sequence Info", "Additional Info",];
      break;
    case 'amrphenotypes':
      fieldFile = amrphenotypeFields;
      allowedFields = ['taxon_id', 'genome_id', 'genome_name', 'antibiotic', 'evidence', 'pmid', 'resistant_phenotype', 'measurement_sign', 'measurement_value', 'measurement_unit', 'laboratory_typing_method', 'laboratory_typing_method_version', 'laboratory_typing_platform', 'vendor', 'testing_standard', 'testing_standard_year', 'computational_method', 'computational_method_version', 'computational_method_performance'];
      order = ["Summary","Measurement","Laboratory Method","Computational Method"];
      break;
    case 'features':
      fieldFile = featureFields;
      allowedFields = ['genome_id', 'genome_name', 'taxon_id', 'sequence_id', 'accession', 'annotation', 'feature_type', 'feature_id', 'alt_locus_tag', 'patric_id', 'refseq_locus_tag', 'protein_id', 'gene_id', 'uniprotkb_accession', 'pdb_accession', 'start', 'end', 'strand', 'location', 'segments', 'Codon Start', 'na_length', 'aa_length', 'na_sequence_md5', 'aa_sequence_md5', 'gene', 'date_inserted', 'product', 'plfam_id','pgfam_id', 'sog_id', 'og_id', 'go','property', 'notes', 'classifier_score', 'classifier_round'];
      order = ['Genome','Source','Identifiers','DB Cross References','Location','Sequences','Annotation','Families','Misc','Provenance'];
      break;
    case 'strains':
      fieldFile = strainsFields;
      allowedFields = ['taxon_id', 'family', 'genus', 'species', 'strain', 'subtype', 'h_type', 'n_type', 'genome_ids', 'genbank_accessions', 'segment_count', 'status', 'host_group', 'host_common_name', 'host_name', 'lab_host', 'passage', 'geographic_group', 'isolation_country', 'collection_year', 'collection_date', 'season', '1_pb2', '2_pb1', '3_pa', '4_ha', '5_np', '6_na', '7_mp', '8_ns', 's', 'm', 'l', 'other_segments', 'date_inserted'];
      order = ['Genome Info','Strain Info'];
      break;
    case 'domainsandmotifs':
      fieldFile = domainsandmotifsFields;
      allowedFields = ['genome_id', 'genome_name', 'taxon_id', 'patric_id', 'refseq_locus_tag', 'gene', 'product', 'interpro_id', 'interpro_description', 'feature_type', 'source', 'source_id', 'description', 'classification', 'score', 'e_value', 'evidence', 'publication', 'start', 'end', 'segments', 'length', 'sequence', 'comments', 'date_inserted'];
      order = ['Genome Info','Sequence Info','Feature Info','Additional Info'];
      break;
    case 'epitopes':
      fieldFile = epitopeFields;
      allowedFields = ['epitope_id', 'epitope_type', 'epitope_sequence', 'organism', 'taxon_id', 'protein_name', 'protein_id', 'protein_accession', 'start', 'end', 'host_name', 'total_assays', 'assay_results', 'bcell_assays', 'tcell_assays', 'mhc_assays', 'comments', 'date_inserted'];
      order = ['Epitope Info','Additional Info'];
      break;
    case 'proteinstructures':
      fieldFile = proteinstructureFields;
      allowedFields = ['pdb_id', 'title', 'organism_name', 'taxon_id', 'genome_id', 'patric_id', 'uniprotkb_accession', 'gene', 'product', 'method', 'resolution', 'pmid', 'institution', 'authors', 'release_date', 'file_path', 'date_inserted'];
      order = ['General Info','Structure Info','Additional Info'];
      break;
    case 'surveillance':
      fieldFile = surveillanceFields;
      allowedFields = [];
      order = [];
      break;
    case 'serology':
      fieldFile = serologyFields;
      allowedFields = [];
      order = [];
      break;
    case 'taxa':
      fieldFile = taxaFields;
      allowedFields = [];
      order = [];
      break;
    case 'experiments':
      fieldFile = experimentFields;
      allowedFields = [];
      order = [];
      break;
    case 'biosets':
      fieldFile = biosetFields;
      allowedFields = [];
      order = [];
      break;
  }

  displayColumns = Object.values(fieldFile).map((obj) => ({
    id: obj.field,
    label: obj.label,
    visible: !obj.hidden,
    group: obj.group,
  }));

  const grouped = displayColumns.reduce(
    (acc: Record<string, typeof displayColumns>, item) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group].push(item);
      return acc;
    },
    {}
  );


  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () =>
      order.reduce((acc, group) => {
        acc[group] = true;
        return acc;
      }, {} as Record<string, boolean>)
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

  return (
    <div className="w-full p-4 overflow-y-auto text-xs">
      <div className="mb-2">
        <span className="font-bold">Selected Tab:</span> {activeTab}
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

                        return (
                          <tr key={item.id}>
                            <td className="px-2 py-0.5 font-medium text-xs w-[40%]">
                              {item.label}
                            </td>
                            <td className="px-2 py-0.5 text-xs break-all">
                              {value}
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
    </div>
  );
}
