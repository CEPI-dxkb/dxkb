import type {
  FastqUtilitiesFormData,
  PipelineActionItem,
  PipelineAction,
} from "./fastq-utilities-form-schema";
import { pipelineActionOptions } from "./fastq-utilities-form-schema";

export const actionColors = [
  "bg-purple-500",
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
] as const;

export function transformFastqUtilitiesParams(
  data: FastqUtilitiesFormData,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    output_path: data.output_path,
    output_file: data.output_file.trim(),
    recipe: data.recipe,
  };

  if (data.recipe.includes("align") && data.reference_genome_id) {
    params.reference_genome_id = data.reference_genome_id.trim();
  }

  if (data.paired_end_libs && data.paired_end_libs.length > 0) {
    params.paired_end_libs = data.paired_end_libs.map((lib) => ({
      read1: lib.read1,
      read2: lib.read2,
    }));
  }

  if (data.single_end_libs && data.single_end_libs.length > 0) {
    params.single_end_libs = data.single_end_libs.map((lib) => ({
      read: lib.read,
      platform: lib.platform,
    }));
  }

  if (data.srr_ids && data.srr_ids.length > 0) {
    params.srr_libs = data.srr_ids.map((srrId) => ({
      srr_accession: srrId,
    }));
  }

  return params;
}

export function isAlignSelected(recipe: PipelineAction[]): boolean {
  return recipe.includes("align");
}

function getActionLabel(action: PipelineAction): string {
  const option = pipelineActionOptions.find((opt) => opt.value === action);
  return option?.label || action;
}

function getColorForIndex(index: number): string {
  return actionColors[index % actionColors.length];
}

export function createPipelineActionItem(
  action: PipelineAction,
  index = 0,
): PipelineActionItem {
  return {
    id: `${action}_${crypto.randomUUID()}`,
    action,
    label: getActionLabel(action),
    color: getColorForIndex(index),
  };
}

function renormalizePipelineActions(
  items: PipelineActionItem[],
): PipelineActionItem[] {
  return items.map((item, index) => ({
    ...item,
    color: getColorForIndex(index),
  }));
}

export function removePipelineActionItem(
  items: PipelineActionItem[],
  id: string,
): PipelineActionItem[] {
  const filtered = items.filter((item) => item.id !== id);
  return renormalizePipelineActions(filtered);
}

export function actionItemsToRecipe(
  items: PipelineActionItem[],
): PipelineAction[] {
  return items.map((item) => item.action);
}
