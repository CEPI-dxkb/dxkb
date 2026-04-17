import { tr } from "date-fns/locale";

export const serologyFields = {
    project_identifier: { 
        label: 'Project Identifier', 
        field: 'project_identifier', 
        hidden: true,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    contributing_institution: { 
        label: 'Contributing Institution', 
        field: 'contributing_institution', 
        hidden: true,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    sample_identifier: { 
        label: 'Sample Identifier', 
        field: 'sample_identifier', 
        hidden: false,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
        
    host_identifier: { 
        label: 'Host Identifier', 
        field: 'host_identifier', 
        hidden: false,
        group: 'Host Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    host_type: { 
        label: 'Host Type', 
        field: 'host_type', 
        hidden: false,
        group: 'Host Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    host_species: { 
        label: 'Host Species', 
        field: 'host_species', 
        hidden: false,
        group: 'Host Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    host_common_name: { 
        label: 'Host Common Name', 
        field: 'host_common_name', 
        hidden: false,
        group: 'Host Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    host_sex: { 
        label: 'Host Sex', 
        field: 'host_sex', 
        hidden: false,
        group: 'Host Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    host_age: { 
        label: 'Host Age', 
        field: 'host_age', 
        hidden: false,
        group: 'Host Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    host_age_group: { 
        label: 'Host Age Group', 
        field: 'host_age_group', 
        hidden: false,
        group: 'Host Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    host_health: { 
        label: 'Host Health', 
        field: 'host_health', 
        hidden: false,
        group: 'Host Info',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
        
    collection_country: { 
        label: 'Collection Country', 
        field: 'collection_country', 
        hidden: true,
        group: 'Sample Collection',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    collection_state: { 
        label: 'Collection State', 
        field: 'collection_state', 
        hidden: true,
        group: 'Sample Collection',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    collection_city: { 
        label: 'Collection City', 
        field: 'collection_city', 
        hidden: true,
        group: 'Sample Collection',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    collection_date: { 
        label: 'Collection Date', 
        field: 'collection_date', 
        hidden: false,
        group: 'Sample Collection',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    collection_year: { 
        label: 'Collection Year', 
        field: 'collection_year', 
        hidden: true,
        group: 'Sample Collection',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    geographic_group: { 
        label: 'Geographic Group', 
        field: 'geographic_group', 
        hidden: true,
        group: 'Sample Collection',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
        
    test_type: { 
        label: 'Test Type', 
        field: 'test_type', 
        hidden: false,
        group: 'Sample Tests',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    test_result: { 
        label: 'Test Result', 
        field: 'test_result', 
        hidden: false,
        group: 'Sample Tests',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    test_interpretation: { 
        label: 'Test Interpretation', 
        field: 'test_interpretation', 
        hidden: false,
        group: 'Sample Tests',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    serotype: { 
        label: 'Serotype', 
        field: 'serotype', 
        hidden: false,
        group: 'Sample Tests',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
        
    comments: { 
        label: 'Comments', 
        field: 'comments', 
        hidden: true,
        group: 'Other',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    date_added: { 
        label: 'Date Inserted', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Sample Tests',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    date_updated: { 
        label: 'Date Updated', 
        field: 'date_updated', 
        hidden: true,
        group: 'Sample Tests',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    };