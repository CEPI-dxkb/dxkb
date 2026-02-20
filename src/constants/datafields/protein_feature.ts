export const protein_featureFields = {
    id: { 
        label: 'ID', 
        field: 'id', 
        hidden: true,
        group: 'Genome Info' 
        },
    genome_id: { 
        label: 'Genome ID', 
        field: 'genome_id', 
        hidden: true,
        group: 'Genome Info',
        link: '/view/Genome/{value}' 
        },
    genome_name: { 
        label: 'Genome Name', 
        field: 'genome_name', 
        hidden: true,
        group: 'Genome Info' 
        },
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'Genome Info',
        link: '/view/Taxonomy/{value}' 
        },
    feature_id: { 
        label: 'Feature ID', 
        field: 'feature_id', 
        hidden: true,
        group: 'Genome Info' 
        },
    patric_id: { 
        label: 'BRC ID', 
        field: 'patric_id', 
        hidden: false,
        group: 'Genome Info',
        link: '/view/Feature/{value}' 
        },
    refseq_locus_tag: { 
        label: 'RefSeq Locus Tag', 
        field: 'refseq_locus_tag', 
        hidden: false,
        group: 'Sequence Info',
        link: 'http://www.ncbi.nlm.nih.gov/protein/?term={value}' 
        },
    aa_sequence_md5: { 
        label: 'AA Sequence MD5', 
        field: 'aa_sequence_md5', 
        hidden: true,
        group: 'Sequence Info' 
        },
    gene: { 
        label: 'Gene', 
        field: 'gene', 
        hidden: false,
        group: 'Feature Info' 
        },
    product: { 
        label: 'Product', 
        field: 'product', 
        hidden: false,
        group: 'Feature Info' 
        },
    interpro_id: { 
        label: 'Interpro ID', 
        field: 'interpro_id', 
        hidden: true,
        group: 'Feature Info',
        link: 'https://www.ebi.ac.uk/interpro/entry/InterPro/{value}/' 
        },
    interpro_description: { 
        label: 'Interpro Description', 
        field: 'interpro_description', 
        hidden: true,
        group: 'Feature Info' 
        },
    feature_type: { 
        label: 'Feature Type', 
        field: 'feature_type', 
        hidden: true,
        group: 'Feature Info' 
        },
    source: { 
        label: 'Source', 
        field: 'source', 
        hidden: false,
        group: 'Feature Info' 
        },
    source_id: { 
        label: 'Source ID', 
        field: 'source_id', 
        hidden: false,
        group: 'Feature Info',
        link: 'https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid={value}' 
        },
    description: { 
        label: 'Description', 
        field: 'description', 
        hidden: false,
        group: 'Feature Info' 
        },
    classification: { 
        label: 'Classification', 
        field: 'classification', 
        hidden: true,
        group: 'Feature Info' 
        },
    score: { 
        label: 'Score', 
        field: 'score', 
        hidden: true,
        group: 'Feature Info' 
        },
    e_value: { 
        label: 'E Value', 
        field: 'e_value', 
        hidden: false,
        group: 'Feature Info' 
        },
    evidence: { 
        label: 'Evidence', 
        field: 'evidence', 
        hidden: false,
        group: 'Feature Info' 
        },
    publication: { 
        label: 'Publication', 
        field: 'publication', 
        hidden: true,
        group: 'Feature Info' 
        },
    start: { 
        label: 'Start', 
        field: 'start', 
        hidden: true,
        group: 'Feature Info' 
        },
    end: { 
        label: 'End', 
        field: 'end', 
        hidden: true,
        group: 'Feature Info' 
        },
    segments: { 
        label: 'Segments', 
        field: 'segments', 
        hidden: true,
        group: 'Feature Info' 
        },
    length: { 
        label: 'Length', 
        field: 'length', 
        hidden: true,
        group: 'Feature Info' 
        },
    sequence: { 
        label: 'Sequence', 
        field: 'sequence', 
        hidden: true,
        group: 'Feature Info' 
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