export const surveillanceFields = {
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
        hidden: false,
        group: 'Sample Info',
        facet: true, 
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
    sample_accession: { 
        label: 'Sample Accession', 
        field: 'sample_accession', 
        hidden: true,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    sequence_accession: { 
        label: 'Sequence Accession', 
        field: 'sequence_accession', 
        hidden: true,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    sample_material: { 
        label: 'Sample Material', 
        field: 'sample_material', 
        hidden: false,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    sample_transport_medium: { 
        label: 'Sample Transport Medium', 
        field: 'sample_transport_medium', 
        hidden: true,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    sample_receipt_date: { 
        label: 'Sample Receipt Date', 
        field: 'sample_receipt_date', 
        hidden: true,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    submission_date: { 
        label: 'Submission Date', 
        field: 'submission_date', 
        hidden: true,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    last_update_date: { 
        label: 'Last Update Date', 
        field: 'last_update_date', 
        hidden: true,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    longitudinal_study: { 
        label: 'Longitudinal Study', 
        field: 'longitudinal_study', 
        hidden: true,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    embargo_end_date: { 
        label: 'Embargo End Date', 
        field: 'embargo_end_date', 
        hidden: true,
        group: 'Sample Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
        
    // Sample Collection
    collector_name: { 
        label: 'Collector Name', 
        field: 'collector_name', 
        hidden: true,
        group: 'Sample Collection',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    collector_institution: { 
        label: 'Collector Institution', 
        field: 'collector_institution', 
        hidden: true,
        group: 'Sample Collection',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    contact_email_address: { 
        label: 'Contact Email Address', 
        field: 'contact_email_address', 
        hidden: true,
        group: 'Sample Collection',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    collection_date: { 
        label: 'Collection Date', 
        field: 'collection_date', 
        hidden: true,
        group: 'Sample Collection',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    collection_year: { 
        label: 'Collection Year', 
        field: 'collection_year', 
        hidden: false,
        group: 'Sample Collection',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },  
    collection_season: { 
        label: 'Collection Season', 
        field: 'collection_season', 
        hidden: true,
        group: 'Sample Collection',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    days_elapsed_to_sample_collection: { 
        label: 'Days Elapsed to Sample Collection', 
        field: 'days_elapsed_to_sample_collection', 
        hidden: true,
        group: 'Sample Collection',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    collection_country: { 
        label: 'Collection Country', 
        field: 'collection_country', 
        hidden: false,
        group: 'Sample Collection',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    collection_state_province: { 
        label: 'Collection State Province', 
        field: 'collection_state_province', 
        hidden: true,
        group: 'Sample Collection',
        facet: true, 
        facet_hidden: true, 
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
    collection_poi: { 
        label: 'Collection POI', 
        field: 'collection_poi', 
        hidden: true,
        group: 'Sample Collection',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    collection_latitude: { 
        label: 'Collection Latitude', 
        field: 'collection_latitude', 
        hidden: true,
        group: 'Sample Collection',
        facet: false, 
        facet_hidden: true, 
        search: false  
        },
    collection_longitude: { 
        label: 'Collection Longitude', 
        field: 'collection_longitude', 
        hidden: true,
        group: 'Sample Collection',
        facet: false, 
        facet_hidden: true, 
        search: false  
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
        
    // Sample Tests
    pathogen_test_type: { 
        label: 'Pathogen Test Type', 
        field: 'pathogen_test_type', 
        hidden: false,
        group: 'Sample Tests',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    pathogen_test_result: { 
        label: 'Pathogen Test Result', 
        field: 'pathogen_test_result', 
        hidden: false,
        group: 'Sample Tests',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    pathogen_test_interpretation: { 
        label: 'Pathogen Test Interpretation', 
        field: 'pathogen_test_interpretation', 
        hidden: true,
        group: 'Sample Tests',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    species: { 
        label: 'Species', 
        field: 'species', 
        hidden: true,
        group: 'Sample Tests',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    pathogen_type: { 
        label: 'Pathogen Type', 
        field: 'pathogen_type', 
        hidden: false,
        group: 'Sample Tests',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    subtype: { 
        label: 'Subtype', 
        field: 'subtype', 
        hidden: false,
        group: 'Sample Tests',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    strain: { 
        label: 'Strain', 
        field: 'strain', 
        hidden: false,
        group: 'Sample Tests',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
        
    // Host Info
    host_identifier: { 
        label: 'Host Identifier', 
        field: 'host_identifier', 
        hidden: false,
        group: 'Host Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    host_id_type: { 
        label: 'Host ID Type', 
        field: 'host_id_type', 
        hidden: true,
        group: 'Host Info',
        facet: false, 
        facet_hidden: true, 
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
    host_group: { 
        label: 'Host Group', 
        field: 'host_group', 
        hidden: true,
        group: 'Host Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    host_sex: { 
        label: 'Host Sex', 
        field: 'host_sex', 
        hidden: true,
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
    host_height: { 
        label: 'Host Height', 
        field: 'host_height', 
        hidden: true,
        group: 'Host Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    host_weight: { 
        label: 'Host Weight', 
        field: 'host_weight', 
        hidden: true,
        group: 'Host Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    host_habitat: { 
        label: 'Host Habitat', 
        field: 'host_habitat', 
        hidden: true,
        group: 'Host Info',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    host_natural_state: { 
        label: 'Host Natural State', 
        field: 'host_natural_state', 
        hidden: true,
        group: 'Host Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    host_capture_status: { 
        label: 'Host Capture Status', 
        field: 'host_capture_status', 
        hidden: true,
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
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
        
    // Environmental Exposure
    exposure: { 
        label: 'Exposure', 
        field: 'exposure', 
        hidden: true,
        group: 'Environmental Exposure',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    duration_of_exposure: { 
        label: 'Duration of Exposure', 
        field: 'duration_of_exposure', 
        hidden: true,
        group: 'Environmental Exposure',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    exposure_type: { 
        label: 'Exposure Type', 
        field: 'exposure_type', 
        hidden: true,
        group: 'Environmental Exposure',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    use_of_personal_protective_equipment: { 
        label: 'Use of Personal Protective Equipment', 
        field: 'use_of_personal_protective_equipment', 
        hidden: true,
        group: 'Environmental Exposure',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    primary_living_situation: { 
        label: 'Primary Living Situation', 
        field: 'primary_living_situation', 
        hidden: true,
        group: 'Environmental Exposure',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    nursing_home_residence: { 
        label: 'Nursing Home Residence', 
        field: 'nursing_home_residence', 
        hidden: true,
        group: 'Environmental Exposure',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    daycare_attendance: { 
        label: 'Daycare Attendance', 
        field: 'daycare_attendance', 
        hidden: true,
        group: 'Environmental Exposure',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    travel_history: { 
        label: 'Travel History', 
        field: 'travel_history', 
        hidden: true,
        group: 'Environmental Exposure',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    profession: { 
        label: 'Profession', 
        field: 'profession', 
        hidden: true,
        group: 'Environmental Exposure',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    education: { 
        label: 'Education', 
        field: 'education', 
        hidden: true,
        group: 'Environmental Exposure',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
        
    // Clinical Data
    pregnancy: { 
        label: 'Pregnancy', 
        field: 'pregnancy', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    trimester_of_pregnancy: { 
        label: 'Trimester of Pregnancy', 
        field: 'trimester_of_pregnancy', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    breastfeeding: { 
        label: 'Breastfeeding', 
        field: 'breastfeeding', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    hospitalized: { 
        label: 'Hospitalized', 
        field: 'hospitalized', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    hospitalization_duration: { 
        label: 'Hospitalization Duration', 
        field: 'hospitalization_duration', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    intensive_care_unit: { 
        label: 'Intensive Care Unit', 
        field: 'intensive_care_unit', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    chest_imaging_interpretation: { 
        label: 'Chest Imaging Interpretation', 
        field: 'chest_imaging_interpretation', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    ventilation: { 
        label: 'Ventilation', 
        field: 'ventilation', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    oxygen_saturation: { 
        label: 'Oxygen Saturation', 
        field: 'oxygen_saturation', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    ecmo: { 
        label: 'Ecmo', 
        field: 'ecmo', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    dialysis: { 
        label: 'Dialysis', 
        field: 'dialysis', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    disease_status: { 
        label: 'Disease Status', 
        field: 'disease_status', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    days_elapsed_to_disease_status: { 
        label: 'Days Elapsed to Disease Status', 
        field: 'days_elapsed_to_disease_status', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    disease_severity: { 
        label: 'Disease Severity', 
        field: 'disease_severity', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    alcohol_or_other_drug_dependence: { 
        label: 'Alcohol Or Other Drug Dependence', 
        field: 'alcohol_or_other_drug_dependence', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    tobacco_use: { 
        label: 'Tobacco Use', 
        field: 'tobacco_use', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    packs_per_day_for_how_many_years: { 
        label: 'Packs Per Day For How Many Years', 
        field: 'packs_per_day_for_how_many_years', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
        
    // Medical History
    chronic_conditions: { 
        label: 'Chronic Conditions', 
        field: 'chronic_conditions', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    maintenance_medications: { 
        label: 'Maintenance Medication', 
        field: 'maintenance_medication', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    types_of_allergies: { 
        label: 'Types of Allergies', 
        field: 'types_of_allergies', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    influenza_like_illness_over_the_past_year: { 
        label: 'Influenza Like Illness Over The Past Year', 
        field: 'influenza_like_illness_over_the_past_year', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    infections_within_five_years: { 
        label: 'Infections Within Five Years', 
        field: 'infections_within_five_years', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    human_leukocyte_antigens: { 
        label: 'Human Leukocyte Antigens', 
        field: 'human_leukocyte_antigens', 
        hidden: true,
        group: 'Clinical Data',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
        
    // Symptoms/Diagnosis
    symptoms: { 
        label: 'Symptoms', 
        field: 'symptoms', 
        hidden: true,
        group: 'Symptoms/Diagnosis',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    onset_hours: { 
        label: 'Onset Hours', 
        field: 'onset_hours', 
        hidden: true,
        group: 'Symptoms/Diagnosis',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    sudden_onset: { 
        label: 'Sudden Onset', 
        field: 'sudden_onset', 
        hidden: true,
        group: 'Symptoms/Diagnosis',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    diagnosis: { 
        label: 'Diagnosis', 
        field: 'diagnosis', 
        hidden: true,
        group: 'Symptoms/Diagnosis',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    pre_visit_medications: { 
        label: 'Pre Visit Medication', 
        field: 'pre_visit_medication', 
        hidden: true,
        group: 'Symptoms/Diagnosis',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    post_visit_medications: { 
        label: 'Post Visit Medication', 
        field: 'post_visit_medication', 
        hidden: true,
        group: 'Symptoms/Diagnosis',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
        
    // Treatment
    treatment_type: { 
        label: 'Treatment Type', 
        field: 'treatment_type', 
        hidden: true,
        group: 'Treatment',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    treatment: { 
        label: 'Treatment', 
        field: 'treatment', 
        hidden: true,
        group: 'Treatment',
        facet: true, 
        facet_hidden: true, 
        search: true  
        },
    initiation_of_treatment: { 
        label: 'Initiation of Treatment', 
        field: 'initiation_of_treatment', 
        hidden: true,
        group: 'Treatment',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    duration_of_treatment: { 
        label: 'Duration of Treatment', 
        field: 'duration_of_treatment', 
        hidden: true,
        group: 'Treatment',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    treatment_dosage: { 
        label: 'Treatment Dosage', 
        field: 'treatment_dosage', 
        hidden: true,
        group: 'Treatment',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
        
    // Vaccination
    vaccination_type: { 
        label: 'Vaccination Type', 
        field: 'vaccination_type', 
        hidden: true,
        group: 'Vaccination', 
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    days_elapsed_to_vaccination: { 
        label: 'Days Elapsed To Vaccination', 
        field: 'days_elapsed_to_vaccination', 
        hidden: true,
        group: 'Vaccination', 
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    source_of_vaccine_information: { 
        label: 'Source of Vaccine Information', 
        field: 'source_of_vaccine_information', 
        hidden: true,
        group: 'Vaccination', 
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    vaccine_lot_number: { 
        label: 'Vaccine Lot Number', 
        field: 'vaccine_lot_number', 
        hidden: true,
        group: 'Vaccination',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    vaccine_manufacturer: { 
        label: 'Vaccine Manufacturer', 
        field: 'vaccine_manufacturer', 
        hidden: true,
        group: 'Vaccination',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    vaccine_dosage: { 
        label: 'Vaccine Dosage', 
        field: 'vaccine_dosage', 
        hidden: true,
        group: 'Vaccination',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    other_vaccinations: { 
        label: 'Other Vaccinations', 
        field: 'other_vaccinations', 
        hidden: true,
        group: 'Vaccination',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
        
    // Other
    additional_metadata: { 
        label: 'Additional Metadata', 
        field: 'additional_metadata', 
        hidden: true,
        group: 'Other',
        facet: false, 
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
    date_inserted: { 
        label: 'Date Inserted', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Other',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    date_updated: { 
        label: 'Date Updated', 
        field: 'date_updated', 
        hidden: true,
        group: 'Other',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    };