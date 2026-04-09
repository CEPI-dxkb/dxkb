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
  Globe,
  FolderOpenDot,
  FolderHeart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isFolderType, normalizeWorkspaceObjectType } from "@/lib/services/workspace/utils";

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

export type FolderIconVariant = "default" | "public" | "shared" | "favorite";

interface WorkspaceItemIconProps {
  type: string;
  className?: string;
  /** Override folder icon based on context (public, shared, or favorite). */
  variant?: FolderIconVariant;
}

const folderVariantIcon: Record<FolderIconVariant, LucideIcon> = {
  default: Folder,
  public: Globe,
  shared: FolderOpenDot,
  favorite: FolderHeart,
};

export function WorkspaceItemIcon({ type, className, variant = "default" }: WorkspaceItemIconProps) {
  const key = normalizeWorkspaceObjectType(type);
  const isFolderLike = isFolderType(type);
  const Icon = isFolderLike
    ? folderVariantIcon[variant]
    : (typeIconMap[key] ?? typeIconMap[type] ?? File);

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
