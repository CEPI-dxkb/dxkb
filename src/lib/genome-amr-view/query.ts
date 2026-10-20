import type { CollectionState } from "@/lib/views/collection-state";
import { structuralFilterRql } from "@/lib/views/structural-rql";

export function genomeAmrStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("genome_amr", state);
}
