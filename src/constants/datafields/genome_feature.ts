export const genome_featureFields = {
    genome_id: { 
        label: 'Genome ID', 
        field: 'genome_id', 
        hidden: false,
        group: 'Genome',
        link: '/view/Genome/{value}',
        facet: false, 
        facet_hidden: false, 
        search: true  
    },
    genome_name: { 
        label: 'Genome Name', 
        field: 'genome_name', 
        hidden: false,
        group: 'Genome',
        link: '/view/Genome/{genome_id}', 
        facet: false, 
        facet_hidden: false, 
        search: true  
        },
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'Genome',
        link: '/view/Taxonomy/{value}',
        facet: false, 
        facet_hidden: false, 
        search: true   
        },
        
    sequence_id: { 
        label: 'Sequence ID', 
        field: 'sequence_id', 
        hidden: true,
        group: 'Sequences',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    accession: { 
        label: 'Accession', 
        field: 'accession', 
        hidden: false,
        group: 'Sequences',
        link: 'https://www.ncbi.nlm.nih.gov/nuccore/{value}',
        facet: false, 
        facet_hidden: false, 
        search: true   
        },
        
    annotation: { 
        label: 'Annotation', 
        field: 'annotation', 
        hidden: true,
        group: 'Source',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    feature_type: { 
        label: 'Feature Type', 
        field: 'feature_type', 
        hidden: false,
        group: 'Source',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
        
    feature_id: { 
        label: 'Feature ID', 
        field: 'feature_id', 
        hidden: true,
        group: 'Source',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    alt_locus_tag: { 
        label: 'Alt Locus Tag', 
        field: 'alt_locus_tag', 
        hidden: true,
        group: 'DB Cross References',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    patric_id: { 
        label: 'BRC ID', 
        field: 'patric_id', 
        hidden: false,
        group: 'Identifiers',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },        
    refseq_locus_tag: { 
        label: 'RefSeq Locus Tag', 
        field: 'refseq_locus_tag', 
        hidden: false,
        group: 'DB Cross References',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
        
    protein_id: { 
        label: 'Protein ID', 
        field: 'protein_id', 
        hidden: true,
        group: 'DB Cross References',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    gene_id: { 
        label: 'Gene ID', 
        field: 'gene_id', 
        hidden: true,
        group: 'DB Cross References',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    uniprotkb_accession: { 
        label: 'UniProtKB Accession', 
        field: 'uniprotkb_accession', 
        hidden: true,
        group: 'Sequences',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    pdb_accession: { 
        label: 'PDB Accession', 
        field: 'pdb_accession', 
        hidden: true,
        group: 'Sequences',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
        
    start: { 
        label: 'Start', 
        field: 'start', 
        hidden: false,
        group: 'Location',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    end: { 
        label: 'End', 
        field: 'end', 
        hidden: false,
        group: 'Location',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    strand: { 
        label: 'Strand', 
        field: 'strand', 
        hidden: false,
        group: 'Location' 
        },
    location: { 
        label: 'Location', 
        field: 'location', 
        hidden: true,
        group: 'Location',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    segments: { 
        label: 'Segments', 
        field: 'segments', 
        hidden: true,
        group: 'Location',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    codon_start: { 
        label: 'Codon Start', 
        field: 'Codon Start', 
        hidden: true,
        group: 'Location',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
        
    na_length: { 
        label: 'Length (NA)', 
        field: 'na_length', 
        hidden: false,
        group: 'Sequences',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    aa_length: { 
        label: 'Length (AA)', 
        field: 'aa_length', 
        hidden: true,
        group: 'Sequences',
        facet: false, 
        facet_hidden: true, 
        search: true     
        },
    na_sequence_md5: { 
        label: 'NA Sequence MD5', 
        field: 'na_sequence_md5', 
        hidden: true,
        group: 'Sequences',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    aa_sequence_md5: { 
        label: 'AA Sequence MD5', 
        field: 'aa_sequence_md5', 
        hidden: true,
        group: 'Sequences',
        facet: false, 
        facet_hidden: true, 
        search: true,  
        linkType: 'button' 
        },
        
    gene: { 
        label: 'Gene Symbol', 
        field: 'gene', 
        hidden: false,
        group: 'Annotation',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    date_added: { 
        label: 'Date Added', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Provenance',
        facet: false, 
        facet_hidden: true, 
        search: true  
    },
    product: { 
        label: 'Product', 
        field: 'product', 
        hidden: false,
        group: 'Annotation',
        facet: true, 
        facet_hidden: true, 
        search: true     
        },

    plfam_id: {
        label: 'PATRIC Local Family',
        field: 'plfam_id',
        hidden: true,
        group: 'Families',
        facet: true, 
        facet_hidden: true, 
        search: true 
    },
    
    pgfam_id: { 
        label: 'PATRIC Global Family', 
        field: 'pgfam_id', 
        hidden: true,
        group: 'Families',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    sog_id: { 
        label: 'SOG ID', 
        field: 'sog_id', 
        hidden: true,
        group: 'Misc',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    og_id: { 
        label: 'OG ID', 
        field: 'og_id', 
        hidden: true,
        group: 'Misc',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    go: { 
        label: 'GO Terms', 
        field: 'go', sortable: false, 
        hidden: true,
        group: 'Misc',
        facet: true, 
        facet_hidden: true, 
        search: true               
        },
        
    property: { 
        label: 'Property', 
        field: 'property', 
        hidden: true,
        group: 'Misc',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    notes: { 
        label: 'Notes', 
        field: 'notes', 
        hidden: true,
        group: 'Misc',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },

    classifier_score: { 
        label: 'Classifier Score', 
        field: 'classifier_score', 
        hidden: true,
        group: 'Misc',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    classifier_round: { 
        label: 'Classifier Round', 
        field: 'classifier_round', 
        hidden: true,
        group: 'Misc',
        facet: false, 
        facet_hidden: true, 
        search: true  
        }
    };