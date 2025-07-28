export const sequenceFields = {
    genome_id: { 
        label: 'Genome ID', 
        field: 'genome_id', 
        hidden: false,
        group: 'General Info' 
        },
    genome_name: { 
        label: 'Genome Name', 
        field: 'genome_name', 
        hidden: false,
        group: 'General Info' 
        },
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'Taxonomy Info' 
        },
    sequence_id: { 
        label: 'Sequence ID', 
        field: 'sequence_id', 
        hidden: true,
        group: 'Sequence Info' 
        },
    accession: { 
        label: 'Accession', 
        field: 'accession', 
        hidden: false,
        group: 'Sequence Info' 
        },
    gi: { 
        label: 'GI', 
        field: 'gi', 
        hidden: true,
        group: 'Sequence Info' 
        },
    sequence_type: { 
        label: 'Sequence Type', 
        field: 'sequence_type', 
        hidden: false,
        group: 'Sequence Info' 
        },
    sequence_status: { 
        label: 'Sequence Status', 
        field: 'sequence_status', 
        hidden: true,
        group: 'Sequence Info' 
        },
    mol_type: { 
        label: 'Mol Type', 
        field: 'mol_type', 
        hidden: false,
        group: 'Sequence Info' 
        },
    topology: { 
        label: 'Topology', 
        field: 'topology', 
        hidden: true,
        group: 'Sequence Info' 
        },
    description: { 
        label: 'Description', 
        field: 'description', 
        hidden: false,
        group: 'Sequence Info' 
        },
    chromosome: { 
        label: 'Chromosome', 
        field: 'chromosome', 
        hidden: true,
        group: 'Sequence Info' 
        },
    plasmid: { 
        label: 'Plasmid', 
        field: 'plasmid', 
        hidden: true,
        group: 'Sequence Info' 
        },
    segment: { 
        label: 'Segment', 
        field: 'segment', 
        hidden: true,
        group: 'Sequence Info' 
        },
    gc_content: { 
        label: 'GC Content %', 
        field: 'gc_content', 
        hidden: false,
        group: 'Sequence Info' 
        },
    length: { 
        label: 'Length (bp)', 
        field: 'length', 
        hidden: false,
        group: 'Sequence Info' 
        },
    sequence_md5: { 
        label: 'Sequence MD5', 
        field: 'sequence_md5', 
        hidden: true,
        group: 'Sequence Info'   
        },
    release_date: { 
        label: 'Release Date', 
        field: 'release_date', 
        hidden: true,
        group: 'Additional Info'   
        },
    version: { 
        label: 'Version', 
        field: 'version', 
        hidden: true,
        group: 'Additional Info'   
        },
    date_inserted: { 
        label: 'Date Inserted', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Additional Info'   
        },
    date_modified: { 
        label: 'Date Modified', 
        field: 'date_modified', 
        hidden: true,
        group: 'Additional Info'  
    }
};