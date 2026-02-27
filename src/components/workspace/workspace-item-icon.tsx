import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  Dna,
  FlaskConical,
  Layers,
  BriefcaseMedical,
  FileArchive,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const typeIconMap: Record<string, LucideIcon> = {
  folder: Folder,
  directory: Folder,
  job_result: BriefcaseMedical,
  contigs: Dna,
  reads: Dna,
  feature_group: FlaskConical,
  genome_group: Layers,
  experiment_group: FlaskConical,
  feature_dna_fasta: Dna,
  feature_protein_fasta: Dna,
  aligned_dna_fasta: Dna,
  aligned_protein_fasta: Dna,
  modelfolder: Folder,
  csv: FileSpreadsheet,
  tsv: FileSpreadsheet,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  json: FileCode,
  html: FileCode,
  xml: FileCode,
  txt: FileText,
  pdf: FileText,
  png: FileImage,
  jpg: FileImage,
  gif: FileImage,
  svg: FileImage,
  nwk: FileCode,
  pdb: FileCode,
  vcf: FileText,
  tar_gz: FileArchive,
};

const typeFolderLike = new Set([
  "folder",
  "directory",
  "job_result",
  "modelfolder",
  "genome_group",
  "feature_group",
  "experiment_group",
]);

const typeFolder= new Set([
  "folder",
  "directory",
  "modelfolder",
]);

function normalizeType(type: string): string {
  return (type ?? "").toLowerCase();
}

interface WorkspaceItemIconProps {
  type: string;
  className?: string;
}

export function WorkspaceItemIcon({ type, className }: WorkspaceItemIconProps) {
  const key = normalizeType(type);
  const Icon = typeIconMap[key] ?? typeIconMap[type] ?? File;
  const isFolderLike = typeFolderLike.has(key);

  return (
    <Icon
      className={cn(
        "h-4 w-4 shrink-0",
        isFolderLike ? "text-amber-500" : "text-muted-foreground",
        className,
      )}
    />
  );
}

export function isFolderType(type: string): boolean {
  return typeFolderLike.has(normalizeType(type));
}

export function isFolder(type: string): boolean {
  return typeFolder.has(normalizeType(type));
}
