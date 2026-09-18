import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { DataRepository } from "./client";
import type {
  CollectionRequest,
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
