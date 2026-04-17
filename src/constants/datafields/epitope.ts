import { tr } from "date-fns/locale";

export const epitopeFields = {
    epitope_id: { 
        label: 'Epitope ID', 
        field: 'epitope_id', 
        hidden: false,
        group: 'Epitope Info',
        link: 'https://www.iedb.org/epitope/{value}',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    epitope_type: { 
        label: 'Epitope Type', 
        field: 'epitope_type', 
        hidden: false,
        group: 'Epitope Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    epitope_sequence: { 
        label: 'Epitope Sequence', 
        field: 'epitope_sequence', 
        hidden: false,
        group: 'Epitope Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
        
    organism: { 
        label: 'Organism', 
        field: 'organism', 
        hidden: false,
        group: 'Epitope Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'Epitope Info',
        link: '/view/Taxonomy/{value}', 
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
        
    protein_name: { 
        label: 'Protein Name', 
        field: 'protein_name', 
        hidden: false,
        group: 'Epitope Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    protein_id: { 
        label: 'Protein ID', 
        field: 'protein_id', 
        hidden: true,
        group: 'Epitope Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    protein_accession: { 
        label: 'Protein Accession', 
        field: 'protein_accession', 
        hidden: true,
        group: 'Epitope Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
        
    start: { 
        label: 'Start', 
        field: 'start', 
        hidden: true,
        group: 'Epitope Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    end: { 
        label: 'End', 
        field: 'end', 
        hidden: true,
        group: 'Epitope Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    host_name: { 
        label: 'Host Name', 
        field: 'host_name', 
        hidden: true,
        group: 'Epitope Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    total_assays: { 
        label: 'Total Assays', 
        field: 'total_assays', 
        hidden: false,
        group: 'Epitope Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    assay_results: { 
        label: 'Assay Results', 
        field: 'assay_results', 
        hidden: true,
        group: 'Epitope Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
        
    bcell_assays: { 
        label: 'Bcell Assays', 
        field: 'bcell_assays', 
        hidden: false,
        group: 'Epitope Info',
        facet: false, 
        facet_hidden: true, 
        search: false  
        },
    tcell_assays: { 
        label: 'Tcell Assays', 
        field: 'tcell_assays', 
        hidden: false,
        group: 'Epitope Info',
        facet: false, 
        facet_hidden: true, 
        search: false  
        },
    mhc_assays: { 
        label: 'MHC Assays', 
        field: 'mhc_assays', 
        hidden: false,
        group: 'Epitope Info',
        facet: false, 
        facet_hidden: true, 
        search: false  
        },
        
    comments: { 
        label: 'Comments', 
        field: 'comments', 
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