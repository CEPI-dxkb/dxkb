export {
  canonicalizeCollectionSearchParams,
  canonicalizeCollectionState,
  parseCollectionState,
  serializeCollectionState,
  updateCollectionSearchParams,
} from "@/lib/views/collection-state";
export type {
  CollectionState,
  CollectionStateOptions,
  CollectionStateUpdate,
} from "@/lib/views/collection-state";

export const resourceCollectionPageSize = 200;
