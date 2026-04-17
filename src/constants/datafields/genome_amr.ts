import { tr } from "date-fns/locale";

export const genome_amrFields = {
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'Summary',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    genome_id: { 
        label: 'Genome ID', 
        field: 'genome_id', 
        hidden: true,
        group: 'Summary',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    genome_name: { 
        label: 'Genome Name', 
        field: 'genome_name', 
        hidden: false,
        group: 'Summary',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    antibiotic: { 
        label: 'Antibiotic', 
        field: 'antibiotic', 
        hidden: false,
        group: 'Summary',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    evidence: { 
        label: 'Evidence', 
        field: 'evidence', 
        hidden: false,
        group: 'Summary',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    pmid: { 
        label: 'Pubmed', 
        field: 'pmid', 
        hidden: false,
        group: 'Summary',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    phenotype: { 
        label: 'Resistant Phenotype', 
        field: 'resistant_phenotype', 
        hidden: false,
        group: 'Summary',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    m_sign: { 
        label: 'Measurement Sign', 
        field: 'measurement_sign', 
        hidden: false,
        group: 'Measurement',
        facet: true, 
        facet_hidden: true, 
        search: true   
        },
    m_value: { 
        label: 'Measurement Value', 
        field: 'measurement_value', 
        hidden: false,
        group: 'Measurement',
        facet: true, 
        facet_hidden: true, 
        search: true   
        },
    m_unit: { 
        label: 'Measurement Units', 
        field: 'measurement_unit', 
        hidden: true,
        group: 'Measurement',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    l_method: { 
        label: 'Lab typing Method', 
        field: 'laboratory_typing_method', 
        hidden: false,
        group: 'Laboratory Method',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    l_version: { 
        label: 'Lab typing Version', 
        field: 'laboratory_typing_method_version', 
        hidden: true,
        group: 'Laboratory Method',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    l_pltform: { 
        label: 'Lab typing Platform', 
        field: 'laboratory_typing_platform', 
        hidden: true,
        group: 'Laboratory Method',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    l_vendor: { 
        label: 'Lab typing Vendor', 
        field: 'vendor', 
        hidden: true,
        group: 'Laboratory Method',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    test_standard: { 
        label: 'Testing standard', 
        field: 'testing_standard', 
        hidden: true,
        group: 'Laboratory Method',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    test_year: { 
        label: 'Testing standard year', 
        field: 'testing_standard_year', 
        hidden: true,
        group: 'Laboratory Method',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    c_method: { 
        label: 'Computational Method', 
        field: 'computational_method', 
        hidden: false,
        group: 'Computational Method',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    c_version: { 
        label: 'Computational Method Version', 
        field: 'computational_method_version', 
        hidden: true,
        group: 'Computational Method',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    c_performance: { 
        label: 'Computational Method Performance', 
        field: 'computational_method_performance', 
        hidden: true,
        group: 'Computational Method',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    };