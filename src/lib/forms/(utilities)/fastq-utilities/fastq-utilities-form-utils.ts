import type {
  FastqUtilitiesFormData,
  PipelineActionItem,
  PipelineAction,
} from "./fastq-utilities-form-schema";
import { PIPELINE_ACTION_OPTIONS } from "./fastq-utilities-form-schema";
import { actionColors, actionShapes } from "@/lib/services/service-utils";

/**
 * Transform FASTQ utilities form data to API parameters
 */
export function transformFastqUtilitiesParams(
  data: FastqUtilitiesFormData
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    output_path: data.output_path,
    output_file: data.output_file.trim(),
    recipe: data.recipe,
  };

  // Add target genome if align is selected
  if (data.recipe.includes("align") && data.reference_genome_id) {
    params.reference_genome_id = data.reference_genome_id.trim();
  }

  // Add paired end libraries
  if (data.paired_end_libs && data.paired_end_libs.length > 0) {
    params.paired_end_libs = data.paired_end_libs.map((lib) => ({
      read1: lib.read1,
      read2: lib.read2,
    }));
  }

  // Add single end libraries with platform
  if (data.single_end_libs && data.single_end_libs.length > 0) {
    params.single_end_libs = data.single_end_libs.map((lib) => ({
      read: lib.read,
      platform: lib.platform,
    }));
  }

  // Add SRA libraries
  if (data.srr_ids && data.srr_ids.length > 0) {
    params.srr_libs = data.srr_ids.map((srrId) => ({
      srr_accession: srrId,
    }));
  }

  return params;
}

/**
 * Check if the Align action is in the recipe
 */
export function isAlignSelected(recipe: PipelineAction[]): boolean {
  return recipe.includes("align");
}

/**
 * Get the label for a pipeline action (internal helper)
 */
function getActionLabel(action: PipelineAction): string {
  const option = PIPELINE_ACTION_OPTIONS.find((opt) => opt.value === action);
  return option?.label || action;
}

/**
 * Color index counter for pipeline actions
 */
let colorIndex = 0;
let shapeIndex = 0;

/**
 * Reset visual index counters
 */
export function resetVisualIndexes(): void {
  colorIndex = 0;
  shapeIndex = 0;
}

/**
 * Get the next color for a pipeline action
 */
export function getNextColor(): string {
  const color = actionColors[colorIndex % actionColors.length];
  colorIndex += 1;
  return color;
}

/**
 * Get the next shape for a pipeline action
 */
export function getNextShape(): string {
  const shape = actionShapes[shapeIndex % actionShapes.length];
  shapeIndex += 1;
  return shape;
}

/**
 * Create a new pipeline action item with visual properties
 */
export function createPipelineActionItem(action: PipelineAction): PipelineActionItem {
  return {
    id: `${action}_${Date.now()}`,
    action,
    label: getActionLabel(action),
    color: getNextColor(),
    shape: getNextShape(),
  };
}

/**
 * Remove a pipeline action item by ID
 */
export function removePipelineActionItem(
  items: PipelineActionItem[],
  id: string
): PipelineActionItem[] {
  return items.filter((item) => item.id !== id);
}

/**
 * Convert pipeline action items to recipe array for form
 */
export function actionItemsToRecipe(items: PipelineActionItem[]): PipelineAction[] {
  return items.map((item) => item.action);
}
