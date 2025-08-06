export const taxaFields = {
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: false,
        group: 'Taxon Info',
        link: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id={value}' 
        },
    taxon_name: { 
        label: 'Taxon Name', 
        field: 'taxon_name', 
        hidden: false,
        group: 'Taxon Info' 
        },
    taxon_rank: { 
        label: 'Taxon Rank', 
        field: 'taxon_rank', 
        hidden: false,
        group: 'Taxon Info' 
        },
    other_names: { 
        label: 'Other Names', 
        field: 'other_names', 
        hidden: false,
        group: 'Taxon Info' 
        },
    genetic_code: { 
        label: 'Genetic Code', 
        field: 'genetic_code', 
        hidden: false,
        group: 'Taxon Info' 
        },
    lineage_names: { 
        label: 'Lineage Names', 
        field: 'lineage_names', 
        hidden: true,
        group: 'Taxon Info',
        show_in_table: false 
        },
    parent_id: { 
        label: 'Parent ID', 
        field: 'parent_id', 
        hidden: true,
        group: 'Taxon Info' 
        },
    division: { 
        label: 'Division', 
        field: 'division', 
        hidden: true,
        group: 'Taxon Info' 
        },
    description: { 
        label: 'Description', 
        field: 'description', 
        hidden: true,
        group: 'Taxon Info' 
        },
    genomes: { 
        label: 'Genomes', 
        field: 'genomes', 
        hidden: false,
        group: 'Taxon Info' 
        },
    };