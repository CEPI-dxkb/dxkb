export const protein_structureFields = {
    pdb_id: { 
        label: 'PDB ID', 
        field: 'pdb_id', 
        hidden: false,
        group: 'General Info',
        link: 'https://www.rcsb.org/structure/{value}' 
        },
    title: { 
        label: 'Title', 
        field: 'title', 
        hidden: false,
        group: 'General Info' 
        },
        
    organism_name: { 
        label: 'Organism Name', 
        field: 'organism_name', 
        hidden: false,
        group: 'General Info' 
        },
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'General Info',
        link: '/view/Taxonomy/{value}' 
        },
    taxon_lineage_ids: { 
        label: 'Taxon Lineage IDs', 
        field: 'taxon_lineage_ids', 
        hidden: true,
        group: 'General Info' 
        },
    taxon_lineage_names: { 
        label: 'Taxon Lineage Names', 
        field: 'taxon_lineage_names', 
        hidden: true,
        group: 'General Info' 
        },
        
    genome_id: { 
        label: 'Genome ID', 
        field: 'genome_id', 
        hidden: true,
        group: 'General Info' 
        },
    patric_id: { 
        label: 'BRC ID', 
        field: 'patric_id', 
        hidden: false,
        group: 'General Info' 
        },
    uniprotkb_accession: { 
        label: 'UniProtKB Accession', 
        field: 'uniprotkb_accession', 
        hidden: false,
        group: 'Structure Info' 
        },
    gene: { 
        label: 'Gene', 
        field: 'gene', 
        hidden: false,
        group: 'Structure Info' 
        },
    product: { 
        label: 'Product', 
        field: 'product', 
        hidden: false,
        group: 'Structure Info' 
        },
    sequence_md5: { 
        label: 'Sequence MD5', 
        field: 'sequence_md5', 
        hidden: true,
        group: 'Structure Info' 
        },
    sequence: { 
        label: 'Sequence', 
        field: 'sequence', 
        hidden: true,
        group: 'Structure Info' 
        },
        
    alignments: { 
        label: 'Alignments', 
        field: 'alignments', 
        hidden: true,
        group: 'Structure Info' 
        },
        
    method: { 
        label: 'Method', 
        field: 'method', 
        hidden: false,
        group: 'Structure Info' 
        },
    resolution: { 
        label: 'Resolution', 
        field: 'resolution', 
        hidden: true,
        group: 'Structure Info' 
        },
    pmid: { 
        label: 'PMID', 
        field: 'pmid', 
        hidden: true,
        group: 'Structure Info' 
        },
    institution: { 
        label: 'Institution', 
        field: 'institution', 
        hidden: true,
        group: 'Structure Info' 
        },
    authors: { 
        label: 'Authors', 
        field: 'authors', 
        hidden: true,
        group: 'Additional Info' 
        },
    release_date: { 
        label: 'Release Date', 
        field: 'release_date', 
        hidden: false,
        group: 'Additional Info' 
        },
    file_path: { 
        label: 'File Path', 
        field: 'file_path', 
        hidden: true,
        group: 'Additional Info' 
        },
    date_added: { 
        label: 'Date Added', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Additional Info'
        }
    };