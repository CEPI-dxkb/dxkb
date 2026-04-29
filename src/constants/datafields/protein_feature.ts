export const protein_featureFields = {
    id: { 
        label: 'ID', 
        field: 'id', 
        hidden: true,
        group: 'Genome Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    genome_id: { 
        label: 'Genome ID', 
        field: 'genome_id', 
        hidden: true,
        group: 'Genome Info',
        link: '/view/Genome/{value}',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    genome_name: { 
        label: 'Genome Name', 
        field: 'genome_name', 
        hidden: true,
        group: 'Genome Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'Genome Info',
        link: '/view/Taxonomy/{value}',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    feature_id: { 
        label: 'Feature ID', 
        field: 'feature_id', 
        hidden: true,
        group: 'Genome Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    patric_id: { 
        label: 'BRC ID', 
        field: 'patric_id', 
        hidden: false,
        group: 'Genome Info',
        link: '/view/Feature/{value}',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    refseq_locus_tag: { 
        label: 'RefSeq Locus Tag', 
        field: 'refseq_locus_tag', 
        hidden: false,
        group: 'Sequence Info',
        link: 'http://www.ncbi.nlm.nih.gov/protein/?term={value}',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    aa_sequence_md5: { 
        label: 'AA Sequence MD5', 
        field: 'aa_sequence_md5', 
        hidden: true,
        group: 'Sequence Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    gene: { 
        label: 'Gene', 
        field: 'gene', 
        hidden: false,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    product: { 
        label: 'Product', 
        field: 'product', 
        hidden: false,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    interpro_id: { 
        label: 'Interpro ID', 
        field: 'interpro_id', 
        hidden: true,
        group: 'Feature Info',
        link: 'https://www.ebi.ac.uk/interpro/entry/InterPro/{value}/',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    interpro_description: { 
        label: 'Interpro Description', 
        field: 'interpro_description', 
        hidden: true,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    feature_type: { 
        label: 'Feature Type', 
        field: 'feature_type', 
        hidden: true,
        group: 'Feature Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    source: { 
        label: 'Source', 
        field: 'source', 
        hidden: false,
        group: 'Feature Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    source_id: { 
        label: 'Source ID', 
        field: 'source_id', 
        hidden: false,
        group: 'Feature Info',
        link: 'https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid={value}',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    description: { 
        label: 'Description', 
        field: 'description', 
        hidden: false,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: true, 
        search: true     
        },
    classification: { 
        label: 'Classification', 
        field: 'classification', 
        hidden: true,
        group: 'Feature Info',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    score: { 
        label: 'Score', 
        field: 'score', 
        hidden: true,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: false, 
        search: true 
        },
    e_value: { 
        label: 'E Value', 
        field: 'e_value', 
        hidden: false,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    evidence: { 
        label: 'Evidence', 
        field: 'evidence', 
        hidden: false,
        group: 'Feature Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    publication: { 
        label: 'Publication', 
        field: 'publication', 
        hidden: true,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    start: { 
        label: 'Start', 
        field: 'start', 
        hidden: true,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    end: { 
        label: 'End', 
        field: 'end', 
        hidden: true,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    segments: { 
        label: 'Segments', 
        field: 'segments', 
        hidden: true,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    length: { 
        label: 'Length', 
        field: 'length', 
        hidden: true,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    sequence: { 
        label: 'Sequence', 
        field: 'sequence', 
        hidden: true,
        group: 'Feature Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
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