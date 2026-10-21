import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { DataRepository } from "./client";
import type {
  CollectionRequest,
  CollectionResult,
  DataResource,
  ExportRequest,
  MemberRequest,
} from "./types";

export const dataQueryKeys = {
  all: ["data-api"] as const,
  resource: (resource: DataResource) =>
    [...dataQueryKeys.all, resource] as const,
  collection: (
    resource: DataResource,
    request: Omit<CollectionRequest, "operation">,
  ) => [...dataQueryKeys.resource(resource), "collection", request] as const,
  member: (resource: DataResource, request: Omit<MemberRequest, "operation">) =>
    [...dataQueryKeys.resource(resource), "member", request] as const,
  // Bulk row reads (the Interactions graph asks for its whole dataset in one
  // request). Keyed on the full request like its siblings, so a changed
  // predicate, projection or limit cannot serve a previous answer.
  export: (resource: DataResource, request: Omit<ExportRequest, "operation">) =>
    [...dataQueryKeys.resource(resource), "export", request] as const,
};

export function collectionQueryOptions<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(
  repository: DataRepository,
  resource: DataResource,
  request: Omit<CollectionRequest, "operation">,
) {
  return queryOptions({
    queryKey: dataQueryKeys.collection(resource, request),
    queryFn: ({ signal }) => repository.collection<Row>(resource, request, signal),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

export function memberQueryOptions<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(
  repository: DataRepository,
  resource: DataResource,
  request: Omit<MemberRequest, "operation">,
) {
  return queryOptions({
    queryKey: dataQueryKeys.member(resource, request),
    queryFn: ({ signal }) => repository.member<Row>(resource, request, signal),
  });
}

type FacetCountRequest = Omit<CollectionRequest, "operation" | "facets">;

interface FacetCountBatch {
  fields: Set<string>;
  // The reads waiting on this request; the last one cancelled aborts it.
  members: number;
  controller: AbortController;
  result: Promise<CollectionResult<Record<string, unknown>>>;
}

// Facet reads waiting to be sent, per repository and scope.
const facetCountBatches = new WeakMap<
  DataRepository,
  Map<string, FacetCountBatch>
>();

function facetCountBatchesFor(repository: DataRepository) {
  let batches = facetCountBatches.get(repository);
  if (!batches) {
    batches = new Map();
    facetCountBatches.set(repository, batches);
  }
  return batches;
}

/**
 * One facet's counts, sent together with every other facet of the same scope
 * asked for in the same task: one HTTP request per scope, which the server
 * fans out upstream in parallel (`ServerDataRepository.collection`). Each
 * field stays its own query, so a newly shown facet reads alone and a Retry
 * re-reads only the failed ones. The request has its own signal, aborted once
 * every read waiting on it is cancelled (its scope left the screen); one
 * cancelled read, such as an unpinned facet, leaves it to the others.
 */
function readFacetCounts(
  repository: DataRepository,
  resource: DataResource,
  request: FacetCountRequest,
  field: string,
  signal: AbortSignal,
) {
  const batches = facetCountBatchesFor(repository);
  const key = JSON.stringify([resource, request]);
  const batch: FacetCountBatch = batches.get(key) ?? {
    fields: new Set(),
    members: 0,
    controller: new AbortController(),
    result: new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      if (batches.get(key) === batch) batches.delete(key);
      // Every read was cancelled before it went out: nothing waits on it.
      batch.controller.signal.throwIfAborted();
      return repository.collection(
        resource,
        { ...request, facets: [...batch.fields] },
        batch.controller.signal,
      );
    }),
  };
  batches.set(key, batch);
  batch.fields.add(field);
  // Members, not fields: Strict Mode cancels a read and starts it again.
  batch.members += 1;
  const leave = () => {
    batch.members -= 1;
    if (batch.members > 0) return;
    if (batches.get(key) === batch) batches.delete(key);
    batch.controller.abort();
  };
  if (signal.aborted) leave();
  else signal.addEventListener("abort", leave, { once: true });
  return batch.result;
}

/**
 * Counts for one facet in a scope: one id and that field's buckets. Reads
 * started together for one scope share a request (`readFacetCounts`), which
 * is aborted when none of them is wanted any more.
 */
export function facetCountQueryOptions(
  repository: DataRepository,
  resource: DataResource,
  request: FacetCountRequest,
  field: string,
) {
  return queryOptions({
    queryKey: dataQueryKeys.collection(resource, {
      ...request,
      facets: [field],
    }),
    queryFn: async ({ signal }) => {
      const result = await readFacetCounts(
        repository,
        resource,
        request,
        field,
        signal,
      );
      return { ...result, facets: { [field]: result.facets[field] } };
    },
    staleTime: 0,
  });
}
