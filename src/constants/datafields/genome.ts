import { fastaFileItemSchema } from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-form-schema";
import { tr } from "date-fns/locale";
import { fa } from "zod/v4/locales";

export const genomeFields = {

      genome_id: {
        label: 'Genome ID',
        field: 'genome_id',
        hidden: true,
        group: 'General Info',
        link: '/view/Genome/{value}', 
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      // General Info
      genome_name: {
        label: 'Genome Name',
        field: 'genome_name',
        hidden: false,
        group: 'General Info', 
        facet: false, 
        facet_hidden: true, 
        search: true  
      },
      other_names: {
        label: 'Other Names',
        field: 'other_names',
        hidden: true,
        group: 'General Info', 
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
  
      // Taxonomy Info
      taxon_id: {
        label: 'NCBI Taxon ID',
        field: 'taxon_id',
        hidden: true,
        group: 'Taxonomy Info',
        link: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id={value}', 
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      taxon_lineage_ids: {
        label: 'Taxon Lineage IDs',
        field: 'taxon_lineage_ids',
        hidden: true,
        group: 'Taxonomy Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      taxon_lineage_names: {
        label: 'Taxon Lineage Names',
        field: 'taxon_lineage_names',
        hidden: true,
        group: 'Taxonomy Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      superkingdom: {
        label: 'Superkingdom',
        field: 'superkingdom',
        hidden: true,
        group: 'Taxonomy Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      kingdom: {
        label: 'Kingdom',
        field: 'kingdom',
        hidden: true,
        group: 'Taxonomy Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      phylum: {
        label: 'Phylum',
        field: 'phylum',
        hidden: true,
        group: 'Taxonomy Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      class: {
        label: 'Class',
        field: 'class',
        hidden: true,
        group: 'Taxonomy Info',
        facet: true, 
        facet_hidden: true, 
        search: true 

      },
      order: {
        label: 'Order',
        field: 'order',
        hidden: true,
        group: 'Taxonomy Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      family: {
        label: 'Family',
        field: 'family',
        hidden: true,
        group: 'Taxonomy Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      genus: {
        label: 'Genus',
        field: 'genus',
        hidden: true,
        group: 'Taxonomy Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      species: {
        label: 'Species',
        field: 'species',
        hidden: true,
        group: 'Taxonomy Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
  
      // Status
      genome_status: {
        label: 'Genome Status',
        field: 'genome_status',
        hidden: true,
        group: 'Status',
        facet: true, 
        facet_hidden: false, 
        search: true 
      },
  
      // Type Info
      strain: {
        label: 'Strain',
        field: 'strain',
        hidden: false,
        group: 'Type Info',
        facet: false, 
        facet_hidden: true, 
        search: true 

      },
      serovar: {
        label: 'Serovar',
        field: 'serovar',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      biovar: {
        label: 'Biovar',
        field: 'biovar',
        hidden: true,
        group: 'Type Info',
        facet: false, 
        facet_hidden: true, 
        search: true 

      },
      pathovar: {
        label: 'Pathovar',
        field: 'pathovar',
        hidden: true,
        group: 'Type Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      mlst: {
        label: 'MLST',
        field: 'mlst',
        hidden: true,
        group: 'Type Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      segment: {
        label: 'Segment',
        field: 'segment',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
      },
      subtype: {
        label: 'Subtype',
        field: 'subtype',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
      },
      h_type: {
        label: 'H_type',
        field: 'h_type',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: false, 
        search: true 

      },
      n_type: {
        label: 'N_type',
        field: 'n_type',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: false, 
        search: true 

      },
      h1_clade_gobal: {
        label: 'H1 Clade Global',
        field: 'h1_clade_global',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      h1_clade_us: {
        label: 'H1 Clade US',
        field: 'h1_clade_us',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      h3_clade: {
        label: 'H3 Clade',
        field: 'h3_clade',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      h5_clade: {
        label: 'H5 Clade',
        field: 'h5_clade',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      ph1n1_like: {
        label: 'pH1N1-like',
        field: 'ph1n1_like',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      lineage: {
        label: 'Lineage',
        field: 'lineage',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
      },
      clade: {
        label: 'Clade',
        field: 'clade',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      subclade: {
        label: 'Subclade',
        field: 'subclade',
        hidden: true,
        group: 'Type Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      other_typing: {
        label: 'Other Typing',
        field: 'other_typing',
        hidden: true,
        group: 'Type Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      culture_collection: {
        label: 'Culture Collection',
        field: 'culture_collection',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      type_strain: {
        label: 'Type Strain',
        field: 'type_strain',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      reference_genome: {
        label: 'Reference',
        field: 'reference_genome',
        hidden: true,
        group: 'Type Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
      },
  
      // Database Cross Reference
      completion_date: {
        label: 'Completion Date',
        field: 'completion_date',
        hidden: true,
        group: 'DB Cross Reference',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      publication: {
        label: 'Publication',
        field: 'publication',
        hidden: true,
        group: 'DB Cross Reference',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      authors: {
        label: 'Authors',
        field: 'authors',
        hidden: true,
        group: 'DB Cross Reference',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      bioproject_accession: {
        label: 'BioProject Accession',
        field: 'bioproject_accession',
        hidden: true,
        group: 'DB Cross Reference',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      biosample_accession: {
        label: 'BioSample Accession',
        field: 'biosample_accession',
        hidden: true,
        group: 'DB Cross Reference',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      assembly_accession: {
        label: 'Assembly Accession',
        field: 'assembly_accession',
        hidden: true,
        group: 'DB Cross Reference',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      sra_accession: {
        label: 'SRA Accession',
        field: 'sra_accession',
        hidden: true,
        group: 'DB Cross Reference',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      genbank_accessions: {
        label: 'GenBank Accessions',
        field: 'genbank_accessions',
        hidden: false,
        group: 'DB Cross Reference',
        link: 'https://www.ncbi.nlm.nih.gov/nuccore/{value}',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
  
      // Sequence Info
      sequencing_centers: {
        label: 'Sequencing Center',
        field: 'sequencing_centers',
        hidden: true,
        group: 'Sequence Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      sequencing_status: {
        label: 'Sequencing Status',
        field: 'sequencing_status',
        hidden: true,
        group: 'Sequence Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      sequencing_platform: {
        label: 'Sequencing Platform',
        field: 'sequencing_platform',
        hidden: true,
        group: 'Sequence Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      sequencing_depth: {
        label: 'Sequencing Depth',
        field: 'sequencing_depth',
        hidden: true,
        group: 'Sequence Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      assembly_method: {
        label: 'Assembly Method',
        field: 'assembly_method',
        hidden: true,
        group: 'Sequence Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
  
      // Genome Statistics
      chromosomes: {
        label: 'Chromosome',
        field: 'chromosomes',
        hidden: true,
        group: 'Genome Statistics',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      plasmids: {
        label: 'Plasmids',
        field: 'plasmids',
        hidden: true,
        group: 'Genome Statistics',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      // segments: {
      //   label: 'Segments',
      //   field: 'Segments',
      //   hidden: true,
      //   group: 'Genome Statistics'
      // },
      contigs: {
        label: 'Contigs',
        field: 'contigs',
        hidden: true,
        group: 'Genome Statistics',
        link: 'https://www.dxkb.org/view/Genome/{genome_id}?activeTab=sequences',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      genome_length: {
        label: 'Size',
        field: 'genome_length',
        hidden: false,
        group: 'Genome Statistics',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      gc_content: {
        label: 'GC Content',
        field: 'gc_content',
        hidden: true,
        group: 'Genome Statistics',
        facet: false, 
        facet_hidden: true, 
        search: true  
      },
      contig_l50: {
        label: 'Contig L50',
        field: 'contig_l50',
        hidden: true,
        group: 'Genome Statistics',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      contig_n50: {
        label: 'Contig N50',
        field: 'contig_n50',
        hidden: true,
        group: 'Genome Statistics',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
  
      // Annotation Statistics
      trna: {
        label: 'TRNA',
        field: 'trna',
        hidden: true,
        group: 'Annotation Statistics',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      rrna: {
        label: 'RRNA',
        field: 'rrna',
        hidden: true,
        group: 'Annotation Statistics',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      mat_peptide: {
        label: 'Mat Peptide',
        field: 'mat_peptide',
        hidden: true,
        group: 'Annotation Statistics',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      cds: {
        label: 'CDS',
        field: 'cds',
        hidden: false,
        group: 'Annotation Statistics',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
  
      // Genome Quality
      genome_quality: {
        label: 'Genome Quality',
        field: 'genome_quality',
        hidden: true,
        group: 'Genome Quality',
        facet: true, 
        facet_hidden: false, 
        search: true 
      },
       coarse_consistency: {
        label: 'Coarse Consistency',
        field: 'coarse_consistency',
        hidden: true,
        group: 'Genome Quality',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      fine_consistency: {
        label: 'Fine Consistency',
        field: 'fine_consistency',
        hidden: true,
        group: 'Genome Quality',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      checkm_completeness: {
        label: 'CheckM Completeness',
        field: 'checkm_completeness',
        hidden: true,
        group: 'Genome Quality',
        facet: false, 
        facet_hidden: true, 
        search: true  
      },
      checkm_contamination: {
        label: 'CheckM Contamination',
        field: 'checkm_contamination',
        hidden: true,
        group: 'Genome Quality',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      genome_quality_flags: {
        label: 'Genome Quality Flags',
        field: 'genome_quality_flags',
        hidden: true,
        sortable: false,
        group: 'Genome Quality',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
  
      // Isolate Info
      isolation_source: {
        label: 'Isolation Source',
        field: 'isolation_source',
        hidden: true,
        group: 'Isolate Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      isolation_comments: {
        label: 'Isolation Comments',
        field: 'isolation_comments',
        hidden: true,
        sortable: false,
        group: 'Isolate Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      collection_date: {
        label: 'Collection Date',
        field: 'collection_date',
        hidden: true,
        group: 'Isolate Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      collection_year: {
        label: 'Collection Year',
        field: 'collection_year',
        hidden: false,
        group: 'Isolate Info',
        facet: true, 
        facet_hidden: false, 
        search: true
      },
      season: {
        label: 'Season',
        field: 'season',
        hidden: true,
        group: 'Isolate Info',
        facet: true,
        facet_hidden: true,
        search: false
      },
      isolation_country: {
        label: 'Isolation Country',
        field: 'isolation_country',
        hidden: false,
        group: 'Isolate Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
      },
      state_province: {
        label: 'State/Province',
        field: 'state_province',
        hidden: true,
        group: 'Isolate Info',
        facet: true,
        facet_hidden: false,
        search: true
      },
      geographic_group: {
        label: 'Geographic Group',
        field: 'geographic_group',
        hidden: true,
        group: 'Isolate Info',
        facet: true,
        facet_hidden: false,
        search: true
      },
      geographic_location: {
        label: 'Geographic Location',
        field: 'geographic_location',
        hidden: true,
        group: 'Isolate Info',
        facet: false,
        facet_hidden: true,
        search: true
      },
      other_environmental: {
        label: 'Other Environmental',
        field: 'other_environmental',
        hidden: true,
        sortable: false,
        group: 'Isolate Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
  
      // Host Info
      host_name: {
        label: 'Host Name',
        field: 'host_name',
        hidden: true,
        group: 'Host Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      host_common_name: {
        label: 'Host Common Name',
        field: 'host_common_name',
        hidden: false,
        group: 'Host Info',
        facet: true,
        facet_hidden: false,
        search: true  
      },
      host_gender: {
        label: 'Host Gender',
        field: 'host_gender',
        hidden: true,
        group: 'Host Info',
        facet: true,
        facet_hidden: true,
        search: true
      },
      host_age: {
        label: 'Host Age',
        field: 'host_age',
        hidden: true,
        group: 'Host Info',
        facet: false,
        facet_hidden: true,
        search: true
      },
      host_health: {
        label: 'Host Health',
        field: 'host_health',
        hidden: true,
        group: 'Host Info',
        facet: false,
        facet_hidden: true,
        search: true
      },
      host_group: {
        label: 'Host Group',
        field: 'host_group',
        hidden: true,
        group: 'Host Info',
        facet: true,
        facet_hidden: false,
        search: true
      },
      lab_host: {
        label: 'Lab Host',
        field: 'lab_host',
        hidden: true,
        group: 'Host Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      passage: {
        label: 'Passage',
        field: 'passage',
        hidden: true,
        group: 'Host Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
      },
      other_clinical: {
        label: 'Other Clinical',
        field: 'other_clinical',
        hidden: true,
        group: 'Host Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
  
      // Additon Info
      additional_metadata: {
        label: 'Additional Metadata',
        field: 'additional_metadata',
        hidden: true,
        sortable: false,
        group: 'Additional Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      comments: {
        label: 'Comments',
        field: 'comments',
        hidden: true,
        sortable: false,
        group: 'Additional Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      date_inserted: {
        label: 'Date Inserted',
        field: 'date_inserted',
        hidden: false,
        group: 'Additional Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
      date_modified: {
        label: 'Date Modified',
        field: 'date_modified',
        hidden: true,
        group: 'Additional Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
      },
    };