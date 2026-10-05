import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Ban,
} from "lucide-react";
import { CirclePlaySpinner } from "./icons";

/** Status display configuration for job status cells and badges. */
export const statusConfig: Record<
  string,
  { icon: React.ElementType; className: string; label: string }
> = {
  completed: {
    icon: CheckCircle2,
    className: "text-success",
    label: "Completed",
  },
  failed: { icon: XCircle, className: "text-destructive", label: "Failed" },
  error: { icon: AlertCircle, className: "text-destructive", label: "Error" },
  running: {
    icon: CirclePlaySpinner,
    className: "text-accent",
    label: "Running",
  },
  "in-progress": {
    icon: CirclePlaySpinner,
    className: "text-accent",
    label: "Running",
  },
  queued: { icon: Clock, className: "text-muted-foreground", label: "Queued" },
  pending: {
    icon: Clock,
    className: "text-muted-foreground",
    label: "Pending",
  },
  cancelled: {
    icon: Ban,
    className: "text-muted-foreground",
    label: "Cancelled",
  },
};

/** Status filter options for the jobs toolbar dropdown. */
export const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

/** Job statuses that indicate the job is still active (for polling). */
export const activeJobStatuses = [
  "pending",
  "queued",
  "running",
  "in-progress",
];

/** Available page size options for the jobs list. */
export const pageSizeOptions = [25, 50, 100, 200, 500, 1000] as const;

/** Default page size for the jobs list. */
export const defaultPageSize = 200;

/** Default column display order for the jobs table. */
export const defaultJobsColumnOrder = [
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
export const serviceNames: ServiceNameEntry[] = [
  { value: "ComprehensiveSARS2Analysis", displayName: "SARS-CoV-2 Genome Analysis" },
  { value: "SubspeciesClassification", displayName: "Subspecies Classification" },
  { value: "Docking", displayName: "Docking" },
  { value: "MetagenomicReadMapping", displayName: "Metagenomic Read Mapping" },
  { value: "Homology", displayName: "BLAST" },
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
