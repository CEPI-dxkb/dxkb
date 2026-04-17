import { tr } from "date-fns/locale";

export const protein_structureFields = {
    pdb_id: { 
        label: 'PDB ID', 
        field: 'pdb_id', 
        hidden: false,
        group: 'General Info',
        link: 'https://www.rcsb.org/structure/{value}',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    title: { 
        label: 'Title', 
        field: 'title', 
        hidden: false,
        group: 'General Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
        
    organism_name: { 
        label: 'Organism Name', 
        field: 'organism_name', 
        hidden: false,
        group: 'General Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'General Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    taxon_lineage_ids: { 
        label: 'Taxon Lineage IDs', 
        field: 'taxon_lineage_ids', 
        hidden: true,
        group: 'General Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    taxon_lineage_names: { 
        label: 'Taxon Lineage Names', 
        field: 'taxon_lineage_names', 
        hidden: true,
        group: 'General Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
        
    genome_id: { 
        label: 'Genome ID', 
        field: 'genome_id', 
        hidden: true,
        group: 'General Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    patric_id: { 
        label: 'BRC ID', 
        field: 'patric_id', 
        hidden: false,
        group: 'General Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    uniprotkb_accession: { 
        label: 'UniProtKB Accession', 
        field: 'uniprotkb_accession', 
        hidden: false,
        group: 'Structure Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    gene: { 
        label: 'Gene', 
        field: 'gene', 
        hidden: false,
        group: 'Structure Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    product: { 
        label: 'Product', 
        field: 'product', 
        hidden: false,
        group: 'Structure Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    sequence_md5: { 
        label: 'Sequence MD5', 
        field: 'sequence_md5', 
        hidden: true,
        group: 'Structure Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    sequence: { 
        label: 'Sequence', 
        field: 'sequence', 
        hidden: true,
        group: 'Structure Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
        
    alignments: { 
        label: 'Alignments', 
        field: 'alignments', 
        hidden: true,
        group: 'Structure Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
        
    method: { 
        label: 'Method', 
        field: 'method', 
        hidden: false,
        group: 'Structure Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    resolution: { 
        label: 'Resolution', 
        field: 'resolution', 
        hidden: true,
        group: 'Structure Info',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    pmid: { 
        label: 'PMID', 
        field: 'pmid', 
        hidden: true,
        group: 'Structure Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    institution: { 
        label: 'Institution', 
        field: 'institution', 
        hidden: true,
        group: 'Structure Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    authors: { 
        label: 'Authors', 
        field: 'authors', 
        hidden: true,
        group: 'Additional Info',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    release_date: { 
        label: 'Release Date', 
        field: 'release_date', 
        hidden: false,
        group: 'Additional Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    file_path: { 
        label: 'File Path', 
        field: 'file_path', 
        hidden: true,
        group: 'Additional Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    date_added: { 
        label: 'Date Added', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Additional Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        }
    };