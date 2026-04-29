export const experimentFields = {
    exp_id: { 
        label: 'Experiment ID', 
        field: 'exp_id', 
        hidden: true,
        group: 'Study Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    study_name: { 
        label: 'Study Name', 
        field: 'study_name', 
        hidden: true,
        group: 'Study Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    study_title: { 
        label: 'Study Title', 
        field: 'study_title', 
        hidden: true,
        group: 'Study Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    study_description:{
        label: 'Description',
        field: 'study_description',
        hidden: true,
        group: 'Study Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    study_pi:{
        label: 'PI',
        field: 'study_pi',
        hidden: true,
        group: 'Study Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    study_institution:{
        label: 'Institution',
        field: 'study_institution',
        hidden: true,
        group: 'Study Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    exp_name: { 
        label: 'Exp Name', 
        field: 'exp_name', 
        hidden: false,
        group: 'Experiment Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    exp_title: { 
        label: 'Exp Title', 
        field: 'exp_title', 
        hidden: false,
        group: 'Experiment Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    exp_description: { 
        label: 'Description', 
        field: 'exp_description', 
        hidden: false,
        group: 'Experiment Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    exp_poc: { 
        label: 'PoC', 
        field: 'exp_poc', 
        hidden: false,
        group: 'Experiment Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    experimenters: { 
        label: 'Experimenters', 
        field: 'experimenters', 
        hidden: false,
        group: 'Experiment Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    public_repository: { 
        label: 'Public Repository', 
        field: 'public_repositories', 
        hidden: false,
        group: 'Experiment Info',
        show_in_table: false,
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    public_id: { 
        label: 'Public Identifier', 
        field: 'public_identifier', 
        hidden: false,
        group: 'Experiment Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    exp_type: { 
        label: 'Exp Type', 
        field: 'exp_type', 
        hidden: false,
        group: 'Experiment Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    measurement_technique: {
        label: 'Meaurement Technique',
        field: 'measurement_technique',
        hidden: true,
        group: 'Experiment Info',
        show_in_table: false,
        facet: true, 
        facet_hidden: false, 
        search: true 
        },   
    organism: {
        label: 'Organism', 
        field: 'organism', 
        hidden: false,
        group: 'Experiment Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    strain: {
        label: 'Strain', 
        field: 'strain', 
        hidden: false,
        group: 'Experiment Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    treatment_type: { 
        label: 'Treatment Type', 
        field: 'treatment_type', 
        hidden: false,
        group: 'Experiment Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    treatment_name: { 
        label: 'Treatment Name', 
        field: 'treatment_name', 
        hidden: false,
        group: 'Experiment Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    treatment_amount: { 
        label: 'Treatment Amount', 
        field: 'treatment_amount', 
        hidden: false,
        group: 'Experiment Info',
        facet: true, 
        facet_hidden: false, 
        search: false  
        },
    treatment_duration: { 
        label: 'Treatment Duration', 
        field: 'treatment_duration', 
        hidden: false,
        group: 'Experiment Info',
        facet: true, 
        facet_hidden: false, 
        search: false  
        },
    samples: { 
        label: 'Samples', 
        field: 'samples', 
        hidden: false,
        group: 'Experiment Info',
        show_in_table: false,
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    biosets: { 
        label: 'Biosets', 
        field: 'biosets', 
        hidden: false,
        group: 'Experiment Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    genome_id: { 
        label: 'Genome ID', 
        field: 'genome_id', 
        hidden: false,
        group: 'Experiment Info',
        show_in_table: false,
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    date_added: { 
        label: 'Date Added', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Additional Metadata',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    additional_metadata: { 
        label: 'Additional Metadata', 
        field: 'additional_metadata', 
        hidden: false,
        group: 'Additional Metadata',
        show_in_table: false,
        facet: false, 
        facet_hidden: true, 
        search: true 
        }
    };