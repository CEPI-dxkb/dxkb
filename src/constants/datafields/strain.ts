export const strainFields = {
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'Genome Info',
        link: '/view/Taxonomy/{value}' 
        },
    taxon_lineage_ids: { 
        label: 'Taxon Lineage IDs', 
        field: 'taxon_lineage_ids', 
        hidden: true,
        group: 'Genome Info' 
        },
    taxon_lineage_names: { 
        label: 'Taxon Lineage Names', 
        field: 'taxon_lineage_names', 
        hidden: true,
        group: 'Genome Info' 
        },
        
    family: { 
        label: 'Family', 
        field: 'family', 
        hidden: true,
        group: 'Genome Info' 
        },
    genus: { 
        label: 'Genus', 
        field: 'genus', 
        hidden: true,
        group: 'Genome Info' 
        },
    species: { 
        label: 'Species', 
        field: 'species', 
        hidden: false,
        group: 'Genome Info' 
        },
    strain: { 
        label: 'Strain', 
        field: 'strain', 
        hidden: false,
        group: 'Strain Info' 
        },
        
    subtype: { 
        label: 'Subtype', 
        field: 'subtype', 
        hidden: true,
        group: 'Strain Info' 
        },
    h_type: { 
        label: 'H Type', 
        field: 'h_type', 
        hidden: true,
        group: 'Strain Info' 
        },
    n_type: { 
        label: 'N Type', 
        field: 'n_type', 
        hidden: true,
        group: 'Strain Info' 
        },
        
    genome_ids: { 
        label: 'Genome IDs', 
        field: 'genome_ids', 
        hidden: true,
        group: 'Strain Info',
        link: '/view/Genome/{value}' 
        },
    genbank_accessions: { 
        label: 'Genbank Accessions', 
        field: 'genbank_accessions', 
        hidden: true,
        group: 'Strain Info',
        link: 'https://www.ncbi.nlm.nih.gov/nuccore/{value}' 
        },
    segment_count: { 
        label: 'Segment Count', 
        field: 'segment_count', 
        hidden: false,
        group: 'Strain Info' 
        },
    status: { 
        label: 'Status', 
        field: 'status', 
        hidden: false,
        group: 'Strain Info' 
        },
        
    host_group: { 
        label: 'Host Group', 
        field: 'host_group', 
        hidden: true,
        group: 'Strain Info' 
        },
    host_common_name: { 
        label: 'Host Common Name', 
        field: 'host_common_name', 
        hidden: false,
        group: 'Strain Info' 
        },
    host_name: { 
        label: 'Host Name', 
        field: 'host_name', 
        hidden: true,
        group: 'Strain Info' 
        },
    lab_host: { 
        label: 'Lab Host', 
        field: 'lab_host', 
        hidden: true,
        group: 'Strain Info' 
        },
    passage: { 
        label: 'Passage', 
        field: 'passage', 
        hidden: true,
        group: 'Strain Info' 
        },
    geographic_group: { 
        label: 'Geographic Group', 
        field: 'geographic_group', 
        hidden: true,
        group: 'Strain Info' 
        },
    isolation_country: { 
        label: 'Isolation Country', 
        field: 'isolation_country', 
        hidden: false,
        group: 'Strain Info' 
        },
    collection_year: { 
        label: 'Collection Year', 
        field: 'collection_year', 
        hidden: true,
        group: 'Strain Info' 
        },
    collection_date: { 
        label: 'Collection Date', 
        field: 'collection_date', 
        hidden: false,
        group: 'Strain Info' 
        },
    season: { 
        label: 'Season', 
        field: 'season', 
        hidden: true,
        group: 'Strain Info' 
        },    
    s_1_pb2: { 
        label: '1_PB2', 
        field: '1_pb2', 
        hidden: false,
        group: 'Strain Info' 
        },
    s_2_pb1: { 
        label: '2_PB1', 
        field: '2_pb1', 
        hidden: false,
        group: 'Strain Info' 
        },
    s_3_pa: { 
        label: '3_PA', 
        field: '3_pa', 
        hidden: false,
        group: 'Strain Info' 
        },
    s_4_ha: { 
        label: '4_HA', 
        field: '4_ha', 
        hidden: false,
        group: 'Strain Info' 
        },
    s_5_np: { 
        label: '5_NP', 
        field: '5_np', 
        hidden: false,
        group: 'Strain Info' 
        },
    s_6_na: { 
        label: '6_NA', 
        field: '6_na', 
        hidden: false,
        group: 'Strain Info' 
        },
    s_7_mp: { 
        label: '7_MP', 
        field: '7_mp', 
        hidden: false,
        group: 'Strain Info' 
        },
    s_8_ns: { 
        label: '8_NS', 
        field: '8_ns', 
        hidden: false,
        group: 'Strain Info' 
        },
    s_s: { 
        label: 'S', 
        field: 's', 
        hidden: false,
        group: 'Strain Info' 
        },
    s_m: { 
        label: 'M', 
        field: 'm', 
        hidden: false,
        group: 'Strain Info' 
        },
    s_l: { 
        label: 'L', 
        field: 'l', 
        hidden: false,
        group: 'Strain Info' 
        },
    s_other_segments: { 
        label: 'Other Segments', 
        field: 'other_segments', 
        hidden: false,
        group: 'Strain Info' 
        },
    date_added: { 
        label: 'Date Added', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Strain Info'
        }
    };