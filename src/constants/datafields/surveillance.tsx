export const surveillanceFields = {
    project_identifier: { 
        label: 'Project Identifier', 
        field: 'project_identifier', 
        hidden: true,
        group: 'Sample Info' 
        },
    contributing_institution: { 
        label: 'Contributing Institution', 
        field: 'contributing_institution', 
        hidden: false,
        group: 'Sample Info' 
        },
    sample_identifier: { 
        label: 'Sample Identifier', 
        field: 'sample_identifier', 
        hidden: false,
        group: 'Sample Info' 
        },
    sample_accession: { 
        label: 'Sample Accession', 
        field: 'sample_accession', 
        hidden: true,
        group: 'Sample Info',
        show_in_table: false 
        },
    sequence_accession: { 
        label: 'Sequence Accession', 
        field: 'sequence_accession', 
        hidden: true,
        group: 'Sample Info' 
        },
    sample_material: { 
        label: 'Sample Material', 
        field: 'sample_material', 
        hidden: false,
        group: 'Sample Info' 
        },
    sample_transport_medium: { 
        label: 'Sample Transport Medium', 
        field: 'sample_transport_medium', 
        hidden: true,
        group: 'Sample Info' 
        },
    sample_receipt_date: { 
        label: 'Sample Receipt Date', 
        field: 'sample_receipt_date', 
        hidden: true,
        group: 'Sample Info' 
        },
    submission_date: { 
        label: 'Submission Date', 
        field: 'submission_date', 
        hidden: true,
        group: 'Sample Info' 
        },
    last_update_date: { 
        label: 'Last Update Date', 
        field: 'last_update_date', 
        hidden: true,
        group: 'Sample Info' 
        },
    longitudinal_study: { 
        label: 'Longitudinal Study', 
        field: 'longitudinal_study', 
        hidden: true,
        group: 'Sample Info' 
        },
    embargo_end_date: { 
        label: 'Embargo End Date', 
        field: 'embargo_end_date', 
        hidden: true,
        group: 'Sample Info' 
        },
        
    // Sample Collection
    collector_name: { 
        label: 'Collector Name', 
        field: 'collector_name', 
        hidden: true,
        group: 'Sample Collection' 
        },
    collector_institution: { 
        label: 'Collector Institution', 
        field: 'collector_institution', 
        hidden: true,
        group: 'Sample Collection' 
        },
    contact_email_address: { 
        label: 'Contact Email Address', 
        field: 'contact_email_address', 
        hidden: true,
        group: 'Sample Collection' 
        },
    collection_date: { 
        label: 'Collection Date', 
        field: 'collection_date', 
        hidden: true,
        group: 'Sample Collection' 
        },
    collection_year: { 
        label: 'Collection Year', 
        field: 'collection_year', 
        hidden: false,
        group: 'Sample Collection' 
        },
    collection_season: { 
        label: 'Collection Season', 
        field: 'collection_season', 
        hidden: true,
        group: 'Sample Collection' 
        },
    days_elapsed_to_sample_collection: { 
        label: 'Days Elapsed to Sample Collection', 
        field: 'days_elapsed_to_sample_collection', 
        hidden: true,
        group: 'Sample Collection' 
        },
    collection_country: { 
        label: 'Collection Country', 
        field: 'collection_country', 
        hidden: false,
        group: 'Sample Collection' 
        },
    collection_state_province: { 
        label: 'Collection State Province', 
        field: 'collection_state_province', 
        hidden: true,
        group: 'Sample Collection' 
        },
    collection_city: { 
        label: 'Collection City', 
        field: 'collection_city', 
        hidden: true,
        group: 'Sample Collection' 
        },
    collection_poi: { 
        label: 'Collection POI', 
        field: 'collection_poi', 
        hidden: true,
        group: 'Sample Collection' 
        },
    collection_latitude: { 
        label: 'Collection Latitude', 
        field: 'collection_latitude', 
        hidden: true,
        group: 'Sample Collection' 
        },
    collection_longitude: { 
        label: 'Collection Longitude', 
        field: 'collection_longitude', 
        hidden: true,
        group: 'Sample Collection' 
        },
    geographic_group: { 
        label: 'Geographic Group', 
        field: 'geographic_group', 
        hidden: true,
        group: 'Sample Collection' 
        },
        
    // Sample Tests
    pathogen_test_type: { 
        label: 'Pathogen Test Type', 
        field: 'pathogen_test_type', 
        hidden: false,
        group: 'Sample Tests' 
        },
    pathogen_test_result: { 
        label: 'Pathogen Test Result', 
        field: 'pathogen_test_result', 
        hidden: false,
        group: 'Sample Tests' 
        },
    pathogen_test_interpretation: { 
        label: 'Pathogen Test Interpretation', 
        field: 'pathogen_test_interpretation', 
        hidden: true,
        group: 'Sample Tests' 
        },
    species: { 
        label: 'Species', 
        field: 'species', 
        hidden: true,
        group: 'Sample Tests' 
        },
    pathogen_type: { 
        label: 'Pathogen Type', 
        field: 'pathogen_type', 
        hidden: false,
        group: 'Sample Tests' 
        },
    subtype: { 
        label: 'Subtype', 
        field: 'subtype', 
        hidden: false,
        group: 'Sample Tests' 
        },
    strain: { 
        label: 'Strain', 
        field: 'strain', 
        hidden: false,
        group: 'Sample Tests' 
        },
        
    // Host Info
    host_identifier: { 
        label: 'Host Identifier', 
        field: 'host_identifier', 
        hidden: false,
        group: 'Host Info' 
        },
    host_id_type: { 
        label: 'Host ID Type', 
        field: 'host_id_type', 
        hidden: true,
        group: 'Host Info' 
        },
    host_species: { 
        label: 'Host Species', 
        field: 'host_species', 
        hidden: false,
        group: 'Host Info' 
        },
    host_common_name: { 
        label: 'Host Common Name', 
        field: 'host_common_name', 
        hidden: false,
        group: 'Host Info' 
        },
    host_group: { 
        label: 'Host Group', 
        field: 'host_group', 
        hidden: true,
        group: 'Host Info' 
        },
    host_sex: { 
        label: 'Host Sex', 
        field: 'host_sex', 
        hidden: true,
        group: 'Host Info' 
        },
    host_age: { 
        label: 'Host Age', 
        field: 'host_age', 
        hidden: false,
        group: 'Host Info' 
        },
    host_height: { 
        label: 'Host Height', 
        field: 'host_height', 
        hidden: true,
        group: 'Host Info' 
        },
    host_weight: { 
        label: 'Host Weight', 
        field: 'host_weight', 
        hidden: true,
        group: 'Host Info' 
        },
    host_habitat: { 
        label: 'Host Habitat', 
        field: 'host_habitat', 
        hidden: true,
        group: 'Host Info' 
        },
    host_natural_state: { 
        label: 'Host Natural State', 
        field: 'host_natural_state', 
        hidden: true,
        group: 'Host Info' 
        },
    host_capture_status: { 
        label: 'Host Capture Status', 
        field: 'host_capture_status', 
        hidden: true,
        group: 'Host Info' 
        },
    host_health: { 
        label: 'Host Health', 
        field: 'host_health', 
        hidden: false,
        group: 'Host Info' 
        },
        
    // Environmental Exposure
    exposure: { 
        label: 'Exposure', 
        field: 'exposure', 
        hidden: true,
        group: 'Environmental Exposure' 
        },
    duration_of_exposure: { 
        label: 'Duration of Exposure', 
        field: 'duration_of_exposure', 
        hidden: true,
        group: 'Environmental Exposure' 
        },
    exposure_type: { 
        label: 'Exposure Type', 
        field: 'exposure_type', 
        hidden: true,
        group: 'Environmental Exposure' 
        },
    use_of_personal_protective_equipment: { 
        label: 'Use of Personal Protective Equipment', 
        field: 'use_of_personal_protective_equipment', 
        hidden: true,
        group: 'Environmental Exposure' 
        },
    primary_living_situation: { 
        label: 'Primary Living Situation', 
        field: 'primary_living_situation', 
        hidden: true,
        group: 'Environmental Exposure' 
        },
    nursing_home_residence: { 
        label: 'Nursing Home Residence', 
        field: 'nursing_home_residence', 
        hidden: true,
        group: 'Environmental Exposure' 
        },
    daycare_attendance: { 
        label: 'Daycare Attendance', 
        field: 'daycare_attendance', 
        hidden: true,
        group: 'Environmental Exposure' 
        },
    travel_history: { 
        label: 'Travel History', 
        field: 'travel_history', 
        hidden: true,
        group: 'Environmental Exposure' 
        },
    profession: { 
        label: 'Profession', 
        field: 'profession', 
        hidden: true,
        group: 'Environmental Exposure' 
        },
    education: { 
        label: 'Education', 
        field: 'education', 
        hidden: true,
        group: 'Environmental Exposure' 
        },
        
    // Clinical Data
    pregnancy: { 
        label: 'Pregnancy', 
        field: 'pregnancy', 
        hidden: true,
        group: 'Clinical Data' 
        },
    trimester_of_pregnancy: { 
        label: 'Trimester of Pregnancy', 
        field: 'trimester_of_pregnancy', 
        hidden: true,
        group: 'Clinical Data' 
        },
    breastfeeding: { 
        label: 'Breastfeeding', 
        field: 'breastfeeding', 
        hidden: true,
        group: 'Clinical Data' 
        },
    hospitalized: { 
        label: 'Hospitalized', 
        field: 'hospitalized', 
        hidden: true,
        group: 'Clinical Data' 
        },
    hospitalization_duration: { 
        label: 'Hospitalization Duration', 
        field: 'hospitalization_duration', 
        hidden: true,
        group: 'Clinical Data' 
        },
    intensive_care_unit: { 
        label: 'Intensive Care Unit', 
        field: 'intensive_care_unit', 
        hidden: true,
        group: 'Clinical Data' 
        },
    chest_imaging_interpretation: { 
        label: 'Chest Imaging Interpretation', 
        field: 'chest_imaging_interpretation', 
        hidden: true,
        group: 'Clinical Data' 
        },
    ventilation: { 
        label: 'Ventilation', 
        field: 'ventilation', 
        hidden: true,
        group: 'Clinical Data' 
        },
    oxygen_saturation: { 
        label: 'Oxygen Saturation', 
        field: 'oxygen_saturation', 
        hidden: true,
        group: 'Clinical Data' 
        },
    ecmo: { 
        label: 'Ecmo', 
        field: 'ecmo', 
        hidden: true,
        group: 'Clinical Data' 
        },
    dialysis: { 
        label: 'Dialysis', 
        field: 'dialysis', 
        hidden: true,
        group: 'Clinical Data' 
        },
    disease_status: { 
        label: 'Disease Status', 
        field: 'disease_status', 
        hidden: true,
        group: 'Clinical Data' 
        },
    days_elapsed_to_disease_status: { 
        label: 'Days Elapsed to Disease Status', 
        field: 'days_elapsed_to_disease_status', 
        hidden: true,
        group: 'Clinical Data' 
        },
    disease_severity: { 
        label: 'Disease Severity', 
        field: 'disease_severity', 
        hidden: true,
        group: 'Clinical Data' 
        },
    alcohol_or_other_drug_dependence: { 
        label: 'Alcohol Or Other Drug Dependence', 
        field: 'alcohol_or_other_drug_dependence', 
        hidden: true,
        group: 'Clinical Data' 
        },
    tobacco_use: { 
        label: 'Tobacco Use', 
        field: 'tobacco_use', 
        hidden: true,
        group: 'Clinical Data' 
        },
    packs_per_day_for_how_many_years: { 
        label: 'Packs Per Day For How Many Years', 
        field: 'packs_per_day_for_how_many_years', 
        hidden: true,
        group: 'Clinical Data' 
        },
        
    // Medical History
    chronic_conditions: { 
        label: 'Chronic Conditions', 
        field: 'chronic_conditions', 
        hidden: true,
        group: 'Clinical Data' 
        },
    maintenance_medications: { 
        label: 'Maintenance Medication', 
        field: 'maintenance_medication', 
        hidden: true,
        group: 'Clinical Data' 
        },
    types_of_allergies: { 
        label: 'Types of Allergies', 
        field: 'types_of_allergies', 
        hidden: true,
        group: 'Clinical Data' 
        },
    influenza_like_illness_over_the_past_year: { 
        label: 'Influenza Like Illness Over The Past Year', 
        field: 'influenza_like_illness_over_the_past_year', 
        hidden: true,
        group: 'Clinical Data' 
        },
    infections_within_five_years: { 
        label: 'Infections Within Five Years', 
        field: 'infections_within_five_years', 
        hidden: true,
        group: 'Clinical Data' 
        },
    human_leukocyte_antigens: { 
        label: 'Human Leukocyte Antigens', 
        field: 'human_leukocyte_antigens', 
        hidden: true,
        group: 'Clinical Data' 
        },
        
    // Symptoms/Diagnosis
    symptoms: { 
        label: 'Symptoms', 
        field: 'symptoms', 
        hidden: true,
        group: 'Symptoms/Diagnosis' 
        },
    onset_hours: { 
        label: 'Onset Hours', 
        field: 'onset_hours', 
        hidden: true,
        group: 'Symptoms/Diagnosis' 
        },
    sudden_onset: { 
        label: 'Sudden Onset', 
        field: 'sudden_onset', 
        hidden: true,
        group: 'Symptoms/Diagnosis' 
        },
    diagnosis: { 
        label: 'Diagnosis', 
        field: 'diagnosis', 
        hidden: true,
        group: 'Symptoms/Diagnosis' 
        },
    pre_visit_medications: { 
        label: 'Pre Visit Medication', 
        field: 'pre_visit_medication', 
        hidden: true,
        group: 'Symptoms/Diagnosis' 
        },
    post_visit_medications: { 
        label: 'Post Visit Medication', 
        field: 'post_visit_medication', 
        hidden: true,
        group: 'Symptoms/Diagnosis' 
        },
        
    // Treatment
    treatment_type: { 
        label: 'Treatment Type', 
        field: 'treatment_type', 
        hidden: true,
        group: 'Treatment' 
        },
    treatment: { 
        label: 'Treatment', 
        field: 'treatment', 
        hidden: true,
        group: 'Treatment' 
        },
    initiation_of_treatment: { 
        label: 'Initiation of Treatment', 
        field: 'initiation_of_treatment', 
        hidden: true,
        group: 'Treatment' 
        },
    duration_of_treatment: { 
        label: 'Duration of Treatment', 
        field: 'duration_of_treatment', 
        hidden: true,
        group: 'Treatment' 
        },
    treatment_dosage: { 
        label: 'Treatment Dosage', 
        field: 'treatment_dosage', 
        hidden: true,
        group: 'Treatment' 
        },
        
    // Vaccination
    vaccination_type: { 
        label: 'Vaccination Type', 
        field: 'vaccination_type', 
        hidden: true,
        group: 'Vaccination' 
        },
    days_elapsed_to_vaccination: { 
        label: 'Days Elapsed To Vaccination', 
        field: 'days_elapsed_to_vaccination', 
        hidden: true,
        group: 'Vaccination' 
        },
    source_of_vaccine_information: { 
        label: 'Source of Vaccine Information', 
        field: 'source_of_vaccine_information', 
        hidden: true,
        group: 'Vaccination' 
        },
    vaccine_lot_number: { 
        label: 'Vaccine Lot Number', 
        field: 'vaccine_lot_number', 
        hidden: true,
        group: 'Vaccination' 
        },
    vaccine_manufacturer: { 
        label: 'Vaccine Manufacturer', 
        field: 'vaccine_manufacturer', 
        hidden: true,
        group: 'Vaccination' 
        },
    vaccine_dosage: { 
        label: 'Vaccine Dosage', 
        field: 'vaccine_dosage', 
        hidden: true,
        group: 'Vaccination' 
        },
    other_vaccinations: { 
        label: 'Other Vaccinations', 
        field: 'other_vaccinations', 
        hidden: true,
        group: 'Vaccination' 
        },
        
    // Other
    additional_metadata: { 
        label: 'Additional Metadata', 
        field: 'additional_metadata', 
        hidden: true,
        group: 'Other' 
        },
    comments: { 
        label: 'Comments', 
        field: 'comments', 
        hidden: true,
        group: 'Other' 
        },
    date_inserted: { 
        label: 'Date Inserted', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Other' 
        },
    date_updated: { 
        label: 'Date Updated', 
        field: 'date_updated', 
        hidden: true,
        group: 'Other' 
        },
    };