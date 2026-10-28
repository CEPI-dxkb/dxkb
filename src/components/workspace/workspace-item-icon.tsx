import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  Dna,
  FlaskConical,
  Layers,
  Flag,
  FileArchive,
  FileSpreadsheet,
  Globe,
  FolderOpenDot,
  FolderHeart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isFolderType, normalizeWorkspaceObjectType } from "@/lib/services/workspace/utils";

const typeIconMap: Partial<Record<string, LucideIcon>> = {
  folder: Folder,
  directory: Folder,
  job_result: Flag,
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
  const ownIcon = typeIconMap[key] ?? typeIconMap[type];
  // Use the variant-aware folder icon when the type is folder-like and has no
  // distinct icon of its own (i.e. would just fall back to the generic Folder).
  const useFolderVariant = isFolderLike && (ownIcon === undefined || ownIcon === Folder);
  const Icon = useFolderVariant ? folderVariantIcon[variant] : (ownIcon ?? File);

  return (
    <Icon
      className={cn(
        "size-4 shrink-0",
        useFolderVariant ? "text-highlight" : "text-muted-foreground",
        className,
      )}
    />
  );
}
