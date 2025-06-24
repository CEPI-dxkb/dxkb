export const featureFields = {
    genome_id: { 
        label: 'Genome ID', 
        field: 'genome_id', 
        hidden: false 
    },
    genome_name: { 
        label: 'Genome Name', 
        field: 'genome_name', 
        hidden: false 
        },
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true 
        },
        
    sequence_id: { 
        label: 'Sequence ID', 
        field: 'sequence_id', 
        hidden: true 
        },
    accession: { 
        label: 'Accession', 
        field: 'accession', 
        hidden: false 
        },
        
    annotation: { 
        label: 'Annotation', 
        field: 'annotation', 
        hidden: true 
        },
    feature_type: { 
        label: 'Feature Type', 
        field: 'feature_type', 
        hidden: false 
        },
        
    feature_id: { 
        label: 'Feature ID', 
        field: 'feature_id', 
        hidden: true 
        },
    alt_locus_tag: { 
        label: 'Alt Locus Tag', 
        field: 'alt_locus_tag', 
        hidden: true 
        },
    patric_id: { 
        label: 'BRC ID', 
        field: 'patric_id', 
        hidden: false 
        },        
    refseq_locus_tag: { 
        label: 'RefSeq Locus Tag', 
        field: 'refseq_locus_tag', 
        hidden: false 
        },
        
    protein_id: { 
        label: 'Protein ID', 
        field: 'protein_id', 
        hidden: true 
        },
    gene_id: { 
        label: 'Gene ID', 
        field: 'gene_id', 
        hidden: true 
        },
    uniprotkb_accession: { 
        label: 'UniProtKB Accession', 
        field: 'uniprotkb_accession', 
        hidden: true 
        },
    pdb_accession: { 
        label: 'PDB Accession', 
        field: 'pdb_accession', 
        hidden: true 
        },
        
    start: { 
        label: 'Start', 
        field: 'start', 
        hidden: false 
        },
    end: { 
        label: 'End', 
        field: 'end', 
        hidden: false 
        },
    strand: { 
        label: 'Strand', 
        field: 'strand', 
        hidden: false 
        },
    location: { 
        label: 'Location', 
        field: 'location', 
        hidden: true 
        },
    segments: { 
        label: 'Segments', 
        field: 'segments', 
        hidden: true 
        },
    codon_start: { 
        label: 'Codon Start', 
        field: 'Codon Start', 
        hidden: true 
        },
        
    na_length: { 
        label: 'Length (NA)', 
        field: 'na_length', 
        hidden: false 
        },
    aa_length: { 
        label: 'Length (AA)', 
        field: 'aa_length', 
        hidden: true 
        },
    na_sequence_md5: { 
        label: 'NA Sequence MD5', 
        field: 'na_sequence_md5', 
        hidden: true 
        },
    aa_sequence_md5: { 
        label: 'AA Sequence MD5', 
        field: 'aa_sequence_md5', 
        hidden: true 
        },
        
    gene: { 
        label: 'Gene Symbol', 
        field: 'gene', 
        hidden: false 
        },
    date_added: { 
        label: 'Date Added', 
        field: 'date_inserted', 
        hidden: false, 
    },
    product: { 
        label: 'Product', 
        field: 'product', 
        hidden: false 
        },

    plfam_id: {
        label: 'PATRIC Local Family',
        field: 'plfam_id',
        hidden: true
    },
    
    pgfam_id: { 
        label: 'PATRIC Global Family', 
        field: 'pgfam_id', 
        hidden: true 
        },
    sog_id: { 
        label: 'SOG ID', 
        field: 'sog_id', 
        hidden: true 
        },
    og_id: { 
        label: 'OG ID', 
        field: 'og_id', 
        hidden: true 
        },
    go: { 
        label: 'GO Terms', 
        field: 'go', sortable: false, 
        hidden: true              
        },
        
    property: { 
        label: 'Property', 
        field: 'property', 
        hidden: true 
        },
    notes: { 
        label: 'Notes', 
        field: 'notes', 
        hidden: true 
        },

    classifier_score: { 
        label: 'Classifier Score', 
        field: 'classifier_score', 
        hidden: true 
        },
    classifier_round: { 
        label: 'Classifier Round', 
        field: 'classifier_round', 
        hidden: true }        
    };