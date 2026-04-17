import { tr } from "date-fns/locale";
import { fa } from "zod/v4/locales";

export const genome_sequenceFields = {
    genome_id: { 
        label: 'Genome ID', 
        field: 'genome_id', 
        hidden: false,
        group: 'General Info',
        link: '/view/Genome/{value}',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    genome_name: { 
        label: 'Genome Name', 
        field: 'genome_name', 
        hidden: false,
        group: 'General Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    taxon_id: { 
        label: 'Taxon ID', 
        field: 'taxon_id', 
        hidden: true,
        group: 'Taxonomy Info',
        link: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id={value}',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    sequence_id: { 
        label: 'Sequence ID', 
        field: 'sequence_id', 
        hidden: true,
        group: 'Sequence Info',
        link: '/view/FeatureList/?and(eq(annotation,PATRIC),eq(sequence_id,{value}),eq(feature_type,CDS))',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    accession: { 
        label: 'Accession', 
        field: 'accession', 
        hidden: false,
        group: 'Sequence Info',
        link: 'https://www.ncbi.nlm.nih.gov/nuccore/{value}',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    gi: { 
        label: 'GI', 
        field: 'gi', 
        hidden: true,
        group: 'Sequence Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    sequence_type: { 
        label: 'Sequence Type', 
        field: 'sequence_type', 
        hidden: false,
        group: 'Sequence Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    sequence_status: { 
        label: 'Sequence Status', 
        field: 'sequence_status', 
        hidden: true,
        group: 'Sequence Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    mol_type: { 
        label: 'Mol Type', 
        field: 'mol_type', 
        hidden: false,
        group: 'Sequence Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    topology: { 
        label: 'Topology', 
        field: 'topology', 
        hidden: true,
        group: 'Sequence Info',
        facet: true, 
        facet_hidden: true, 
        search: true 
        },
    description: { 
        label: 'Description', 
        field: 'description', 
        hidden: false,
        group: 'Sequence Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    chromosome: { 
        label: 'Chromosome', 
        field: 'chromosome', 
        hidden: true,
        group: 'Sequence Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    plasmid: { 
        label: 'Plasmid', 
        field: 'plasmid', 
        hidden: true,
        group: 'Sequence Info',
        facet: true, 
        facet_hidden: false, 
        search: true  
        },
    segment: { 
        label: 'Segment', 
        field: 'segment', 
        hidden: true,
        group: 'Sequence Info',
        facet: true, 
        facet_hidden: false, 
        search: true 
        },
    gc_content: { 
        label: 'GC Content %', 
        field: 'gc_content', 
        hidden: false,
        group: 'Sequence Info',
        facet: false, 
        facet_hidden: true, 
        search: true 
        },
    length: { 
        label: 'Length (bp)', 
        field: 'length', 
        hidden: false,
        group: 'Sequence Info',
        facet: false, 
        facet_hidden: true, 
        search: true  
        },
    sequence_md5: { 
        label: 'Sequence MD5', 
        field: 'sequence_md5', 
        hidden: true,
        group: 'Sequence Info',
        facet: false, 
        facet_hidden: true, 
        search: true    
        },
    release_date: { 
        label: 'Release Date', 
        field: 'release_date', 
        hidden: true,
        group: 'Additional Info',
        facet: false, 
        facet_hidden: true, 
        search: true    
        },
    version: { 
        label: 'Version', 
        field: 'version', 
        hidden: true,
        group: 'Additional Info',
        facet: false, 
        facet_hidden: true, 
        search: true    
        },
    date_inserted: { 
        label: 'Date Inserted', 
        field: 'date_inserted', 
        hidden: false,
        group: 'Additional Info',
        facet: false, 
        facet_hidden: true, 
        search: true    
        },
    date_modified: { 
        label: 'Date Modified', 
        field: 'date_modified', 
        hidden: true,
        group: 'Additional Info',
        facet: false, 
        facet_hidden: true, 
        search: true      
    }
};