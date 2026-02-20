export const genome_featureFields = {
    genome_id: { 
        label: 'Genome ID', 
        field: 'genome_id', 
        hidden: false,
        group: 'Genome',
        link: '/view/Genome/{value}' 
    },
    genome_name: { 
        label: 'Genome Name', 
        field: 'genome_name', 
        hidden: false,
        group: 'Genome',
        link: '/view/Genome/{genome_id}'  
        },
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'Genome',
        link: '/view/Taxonomy/{value}'  
        },
        
    sequence_id: { 
        label: 'Sequence ID', 
        field: 'sequence_id', 
        hidden: true,
        group: 'Sequences' 
        },
    accession: { 
        label: 'Accession', 
        field: 'accession', 
        hidden: false,
        group: 'Sequences',
        link: 'https://www.ncbi.nlm.nih.gov/nuccore/{value}'  
        },
        
    annotation: { 
        label: 'Annotation', 
        field: 'annotation', 
        hidden: true,
        group: 'Source' 
        },
    feature_type: { 
        label: 'Feature Type', 
        field: 'feature_type', 
        hidden: false,
        group: 'Source' 
        },
        
    feature_id: { 
        label: 'Feature ID', 
        field: 'feature_id', 
        hidden: true,
        group: 'Source' 
        },
    alt_locus_tag: { 
        label: 'Alt Locus Tag', 
        field: 'alt_locus_tag', 
        hidden: true,
        group: 'DB Cross References' 
        },
    patric_id: { 
        label: 'BRC ID', 
        field: 'patric_id', 
        hidden: false,
        group: 'Identifiers' 
        },        
    refseq_locus_tag: { 
        label: 'RefSeq Locus Tag', 
        field: 'refseq_locus_tag', 
        hidden: false,
        group: 'DB Cross References' 
        },
        
    protein_id: { 
        label: 'Protein ID', 
        field: 'protein_id', 
        hidden: true,
        group: 'DB Cross References',
        link: 'https://www.ncbi.nlm.nih.gov/protein/{value}' 
        },
    gene_id: { 
        label: 'Gene ID', 
        field: 'gene_id', 
        hidden: true,
        group: 'DB Cross References' 
        },
    uniprotkb_accession: { 
        label: 'UniProtKB Accession', 
        field: 'uniprotkb_accession', 
        hidden: true,
        group: 'Sequences' 
        },
    pdb_accession: { 
        label: 'PDB Accession', 
        field: 'pdb_accession', 
        hidden: true,
        group: 'Sequences' 
        },
        
    start: { 
        label: 'Start', 
        field: 'start', 
        hidden: false,
        group: 'Location' 
        },
    end: { 
        label: 'End', 
        field: 'end', 
        hidden: false,
        group: 'Location' 
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
        group: 'Location' 
        },
    segments: { 
        label: 'Segments', 
        field: 'segments', 
        hidden: true,
        group: 'Location' 
        },
    codon_start: { 
        label: 'Codon Start', 
        field: 'Codon Start', 
        hidden: true,
        group: 'Location' 
        },
        
    na_length: { 
        label: 'Length (NA)', 
        field: 'na_length', 
        hidden: false,
        group: 'Sequences' 
        },
    aa_length: { 
        label: 'Length (AA)', 
        field: 'aa_length', 
        hidden: true,
        group: 'Sequences' 
        },
    na_sequence_md5: { 
        label: 'NA Sequence MD5', 
        field: 'na_sequence_md5', 
        hidden: true,
        group: 'Sequences',
        link: '/view/FASTA/dna/?in(feature_id,({feature_id}))',
        linkType: 'button' 
        },
    aa_sequence_md5: { 
        label: 'AA Sequence MD5', 
        field: 'aa_sequence_md5', 
        hidden: true,
        group: 'Sequences',
        link: '/view/FASTA/protein/?in(feature_id,({feature_id}))',
        linkType: 'button' 
        },
        
    gene: { 
        label: 'Gene Symbol', 
        field: 'gene', 
        hidden: false,
        group: 'Annotation' 
        },
    date_added: { 
        label: 'Date Added', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Provenance' 
    },
    product: { 
        label: 'Product', 
        field: 'product', 
        hidden: false,
        group: 'Annotation' 
        },

    plfam_id: {
        label: 'PATRIC Local Family',
        field: 'plfam_id',
        hidden: true,
        group: 'Families'
    },
    
    pgfam_id: { 
        label: 'PATRIC Global Family', 
        field: 'pgfam_id', 
        hidden: true,
        group: 'Families' 
        },
    sog_id: { 
        label: 'SOG ID', 
        field: 'sog_id', 
        hidden: true,
        group: 'Misc' 
        },
    og_id: { 
        label: 'OG ID', 
        field: 'og_id', 
        hidden: true,
        group: 'Misc' 
        },
    go: { 
        label: 'GO Terms', 
        field: 'go', sortable: false, 
        hidden: true,
        group: 'Misc'              
        },
        
    property: { 
        label: 'Property', 
        field: 'property', 
        hidden: true,
        group: 'Misc' 
        },
    notes: { 
        label: 'Notes', 
        field: 'notes', 
        hidden: true,
        group: 'Misc' 
        },

    classifier_score: { 
        label: 'Classifier Score', 
        field: 'classifier_score', 
        hidden: true,
        group: 'Misc' 
        },
    classifier_round: { 
        label: 'Classifier Round', 
        field: 'classifier_round', 
        hidden: true,
        group: 'Misc'
        }        
    };