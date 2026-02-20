export const epitopeFields = {
    epitope_id: { 
        label: 'Epitope ID', 
        field: 'epitope_id', 
        hidden: false,
        group: 'Epitope Info',
        link: 'https://www.iedb.org/epitope/{value}' 
        },
    epitope_type: { 
        label: 'Epitope Type', 
        field: 'epitope_type', 
        hidden: false,
        group: 'Epitope Info' 
        },
    epitope_sequence: { 
        label: 'Epitope Sequence', 
        field: 'epitope_sequence', 
        hidden: false,
        group: 'Epitope Info' 
        },
        
    organism: { 
        label: 'Organism', 
        field: 'organism', 
        hidden: false,
        group: 'Epitope Info' 
        },
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'Epitope Info',
        link: '/view/Taxonomy/{value}' 
        },
        
    protein_name: { 
        label: 'Protein Name', 
        field: 'protein_name', 
        hidden: false,
        group: 'Epitope Info' 
        },
    protein_id: { 
        label: 'Protein ID', 
        field: 'protein_id', 
        hidden: true,
        group: 'Epitope Info' 
        },
    protein_accession: { 
        label: 'Protein Accession', 
        field: 'protein_accession', 
        hidden: true,
        group: 'Epitope Info' 
        },
        
    start: { 
        label: 'Start', 
        field: 'start', 
        hidden: true,
        group: 'Epitope Info' 
        },
    end: { 
        label: 'End', 
        field: 'end', 
        hidden: true,
        group: 'Epitope Info' 
        },
    host_name: { 
        label: 'Host Name', 
        field: 'host_name', 
        hidden: true,
        group: 'Epitope Info' 
        },
    total_assays: { 
        label: 'Total Assays', 
        field: 'total_assays', 
        hidden: false,
        group: 'Epitope Info' 
        },
    assay_results: { 
        label: 'Assay Results', 
        field: 'assay_results', 
        hidden: true,
        group: 'Epitope Info' 
        },
        
    bcell_assays: { 
        label: 'Bcell Assays', 
        field: 'bcell_assays', 
        hidden: false,
        group: 'Epitope Info' 
        },
    tcell_assays: { 
        label: 'Tcell Assays', 
        field: 'tcell_assays', 
        hidden: false,
        group: 'Epitope Info' 
        },
    mhc_assays: { 
        label: 'MHC Assays', 
        field: 'mhc_assays', 
        hidden: false,
        group: 'Epitope Info' 
        },
        
    comments: { 
        label: 'Comments', 
        field: 'comments', 
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