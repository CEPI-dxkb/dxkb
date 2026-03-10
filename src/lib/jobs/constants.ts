import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Ban,
} from "lucide-react";

/** Status display configuration for job status cells and badges. */
export const statusConfig: Record<
  string,
  { icon: React.ElementType; className: string; label: string }
> = {
  completed: {
    icon: CheckCircle2,
    className: "text-emerald-500",
    label: "Completed",
  },
  failed: { icon: XCircle, className: "text-red-500", label: "Failed" },
  error: { icon: AlertCircle, className: "text-red-600", label: "Error" },
  running: {
    icon: Loader2,
    className: "text-blue-500 animate-spin",
    label: "Running",
  },
  "in-progress": {
    icon: Loader2,
    className: "text-blue-500 animate-spin",
    label: "Running",
  },
  queued: { icon: Clock, className: "text-gray-500", label: "Queued" },
  pending: { icon: Clock, className: "text-gray-400", label: "Pending" },
  cancelled: { icon: Ban, className: "text-orange-500", label: "Cancelled" },
};

/** Status filter options for the jobs toolbar dropdown. */
export const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

/** Job statuses that indicate the job is still active (for polling). */
export const ACTIVE_JOB_STATUSES = [
  "pending",
  "queued",
  "running",
  "in-progress",
];

/** Default page size for the jobs list. */
export const JOBS_PAGE_SIZE = 200;

/** Default column display order for the jobs table. */
export const DEFAULT_JOBS_COLUMN_ORDER = [
  "status",
  "id",
  "app",
  "output_name",
  "submit_time",
  "start_time",
  "completed_time",
];


export interface ServiceNameEntry {
  value: string;
  displayName: string;
}

/** Known service names mapped to their human-readable display names. */
export const SERVICE_NAMES: ServiceNameEntry[] = [
  { value: "ComprehensiveSARS2Analysis", displayName: "Comprehensive SARS2 Analysis" },
  { value: "SubspeciesClassification", displayName: "Subspecies Classification" },
  { value: "Docking", displayName: "Docking" },
  { value: "MetagenomicReadMapping", displayName: "Metagenomic Read Mapping" },
  { value: "Homology", displayName: "Homology" },
  { value: "MetaCATS", displayName: "Meta-CATS" },
  { value: "GenomeAlignment", displayName: "Genome Alignment" },
  { value: "CodonTree", displayName: "Codon Tree" },
  { value: "FastqUtils", displayName: "FastQ Utils" },
  { value: "ComprehensiveGenomeAnalysis", displayName: "Comprehensive Genome Analysis" },
  { value: "Variation", displayName: "Variation" },
  { value: "Genomad", displayName: "geNomad" },
  { value: "GenomeAssembly2", displayName: "Genome Assembly" },
  { value: "HASubtypeNumberingConversion", displayName: "HA Subtype Number Conversion" },
  { value: "PrimerDesign", displayName: "Primer Design" },
  { value: "ViralAssembly", displayName: "Viral Assembly" },
  { value: "SARS2Wastewater", displayName: "SARS2 Wastewater" },
  { value: "MSA", displayName: "MSA" },
  { value: "GeneTree", displayName: "Gene Tree" },
  { value: "RNASeq", displayName: "RNA-Seq" },
  { value: "GenomeAnnotation", displayName: "Genome Annotation" },
  { value: "StabilityPrediction", displayName: "Stability Prediction" },
  { value: "GenomeComparison", displayName: "Genome Comparison" },
  { value: "ComparativeSystems", displayName: "Comparative Systems" },
  { value: "TaxonomicClassification", displayName: "Taxonomic Classification" },
  { value: "MobileElementDetection", displayName: "Mobile Element Detection" },
  { value: "MetagenomeBinning", displayName: "Metagenome Binning" },
];
