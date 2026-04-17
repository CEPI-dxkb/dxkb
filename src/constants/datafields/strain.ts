export const strainFields = {
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
    taxon_lineage_ids: { 
        label: 'Taxon Lineage IDs', 
        field: 'taxon_lineage_ids', 
        hidden: true,
        group: 'Genome Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    taxon_lineage_names: { 
        label: 'Taxon Lineage Names', 
        field: 'taxon_lineage_names', 
        hidden: true,
        group: 'Genome Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
        
    family: { 
        label: 'Family', 
        field: 'family', 
        hidden: true,
        group: 'Genome Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    genus: { 
        label: 'Genus', 
        field: 'genus', 
        hidden: true,
        group: 'Genome Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    species: { 
        label: 'Species', 
        field: 'species', 
        hidden: false,
        group: 'Genome Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    strain: { 
        label: 'Strain', 
        field: 'strain', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
        
    subtype: { 
        label: 'Subtype', 
        field: 'subtype', 
        hidden: true,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    h_type: { 
        label: 'H Type', 
        field: 'h_type', 
        hidden: true,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    n_type: { 
        label: 'N Type', 
        field: 'n_type', 
        hidden: true,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
        
    genome_ids: { 
        label: 'Genome IDs', 
        field: 'genome_ids', 
        hidden: true,
        group: 'Strain Info',
        link: '/view/Genome/{value}',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    genbank_accessions: { 
        label: 'Genbank Accessions', 
        field: 'genbank_accessions', 
        hidden: true,
        group: 'Strain Info',
        link: 'https://www.ncbi.nlm.nih.gov/nuccore/{value}',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    segment_count: { 
        label: 'Segment Count', 
        field: 'segment_count', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    status: { 
        label: 'Status', 
        field: 'status', 
        hidden: false,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
        
    host_group: { 
        label: 'Host Group', 
        field: 'host_group', 
        hidden: true,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    host_common_name: { 
        label: 'Host Common Name', 
        field: 'host_common_name', 
        hidden: false,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    host_name: { 
        label: 'Host Name', 
        field: 'host_name', 
        hidden: true,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    lab_host: { 
        label: 'Lab Host', 
        field: 'lab_host', 
        hidden: true,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    passage: { 
        label: 'Passage', 
        field: 'passage', 
        hidden: true,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    geographic_group: { 
        label: 'Geographic Group', 
        field: 'geographic_group', 
        hidden: true,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    isolation_country: { 
        label: 'Isolation Country', 
        field: 'isolation_country', 
        hidden: false,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    collection_year: { 
        label: 'Collection Year', 
        field: 'collection_year', 
        hidden: true,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    collection_date: { 
        label: 'Collection Date', 
        field: 'collection_date', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    season: { 
        label: 'Season', 
        field: 'season', 
        hidden: true,
        group: 'Strain Info',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },    
    s_1_pb2: { 
        label: '1_PB2', 
        field: '1_pb2', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    s_2_pb1: { 
        label: '2_PB1', 
        field: '2_pb1', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    s_3_pa: { 
        label: '3_PA', 
        field: '3_pa', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    s_4_ha: { 
        label: '4_HA', 
        field: '4_ha', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    s_5_np: { 
        label: '5_NP', 
        field: '5_np', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    s_6_na: { 
        label: '6_NA', 
        field: '6_na', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    s_7_mp: { 
        label: '7_MP', 
        field: '7_mp', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    s_8_ns: { 
        label: '8_NS', 
        field: '8_ns', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    s_s: { 
        label: 'S', 
        field: 's', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    s_m: { 
        label: 'M', 
        field: 'm', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    s_l: { 
        label: 'L', 
        field: 'l', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    s_other_segments: { 
        label: 'Other Segments', 
        field: 'other_segments', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    date_added: { 
        label: 'Date Added', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Strain Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        }
    };