export const taxonomyFields = {
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: false,
        group: 'Taxon Info',
        link: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id={value}', 
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    taxon_name: { 
        label: 'Taxon Name', 
        field: 'taxon_name', 
        hidden: false,
        group: 'Taxon Info', 
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    taxon_rank: { 
        label: 'Taxon Rank', 
        field: 'taxon_rank', 
        hidden: false,
        group: 'Taxon Info', 
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    other_names: { 
        label: 'Other Names', 
        field: 'other_names', 
        hidden: false,
        group: 'Taxon Info', 
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    genetic_code: { 
        label: 'Genetic Code', 
        field: 'genetic_code', 
        hidden: false,
        group: 'Taxon Info', 
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    lineage_names: { 
        label: 'Lineage Names', 
        field: 'lineage_names', 
        hidden: true,
        group: 'Taxon Info',
        show_in_table: false, 
        facet: true, 
        facet_hidden: false, 
        search: false  
        },
    parent_id: { 
        label: 'Parent ID', 
        field: 'parent_id', 
        hidden: true,
        group: 'Taxon Info', 
        facet: true, 
        facet_hidden: false, 
        search: false     
        },
    division: { 
        label: 'Division', 
        field: 'division', 
        hidden: true,
        group: 'Taxon Info', 
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    description: { 
        label: 'Description', 
        field: 'description', 
        hidden: true,
        group: 'Taxon Info', 
        facet: true, 
        facet_hidden: false, 
        search: false  
        },
    genomes: { 
        label: 'Genomes', 
        field: 'genomes', 
        hidden: false,
        group: 'Taxon Info', 
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    };