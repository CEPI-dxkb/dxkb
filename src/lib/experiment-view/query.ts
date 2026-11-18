import { eq, serializeRql, validateRql } from "@/lib/data-api";
import { maxRqlInValues, maxRqlLength } from "@/lib/data-api/rql";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import { rqlKeyword, type SearchParamsRecord } from "@/lib/views/rql";
import {
  structuralFilterRql,
  taxonLineageFieldMap,
} from "@/lib/views/structural-rql";
import { experimentMetadata } from "./fields";

export const experimentSorts = experimentMetadata.sorts;

export const experimentCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...experimentSorts],
  friendlyFilters: ["taxon_id", ...experimentMetadata.facetFields],
};

export function parseExperimentCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, experimentCollectionOptions);
  if (state.rql) state.rql = validateRql("experiment", state.rql);
  return state;
}

export function experimentStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("experiment", state, {
    fieldMap: taxonLineageFieldMap,
  });
}

export function biosetStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("bioset", state);
}

export function experimentBiosetRql(experimentId: string): string {
  return eq("bioset", "exp_id", experimentId);
}

export function experimentCollectionScopeRql(
  state: CollectionState,
): string | undefined {
  const predicates = [
    experimentStructuralRql(state),
    state.refine ? rqlKeyword(state.refine) : undefined,
    state.rql,
  ].filter((predicate): predicate is string => Boolean(predicate));
  if (predicates.length === 0) return undefined;
  return predicates.length === 1
    ? predicates[0]
    : `and(${predicates.join(",")})`;
}

/**
 * The longest experiment-ID scope a Biosets table takes: the Data API rejects RQL
 * over `maxRqlLength`, and the table ands its filters and keyword onto the scope,
 * so this leaves them room.
 */
export const maxBiosetScopeRqlLength = maxRqlLength - 1_500;

/**
 * The most experiment IDs that could fit `maxBiosetScopeRqlLength` (each takes at
 * least one character and a comma); an export of more is over the limit unread.
 */
export const maxBiosetScopeExperiments = Math.floor(maxBiosetScopeRqlLength / 2);

/**
 * The Biosets of these experiments, or `null` when the ID list is too long for
 * one Data API query; the caller asks for a narrower Experiment search instead of
 * sending a request that cannot succeed.
 */
export function experimentBiosetScopeRql(
  experimentIds: string[],
): string | null {
  if (experimentIds.length > maxBiosetScopeExperiments) return null;
  const rql = experimentBiosetCollectionRql(experimentIds);
  return rql.length > maxBiosetScopeRqlLength ? null : rql;
}

/**
 * The Biosets of these experiments. One `in` takes at most `maxRqlInValues`
 * values and a taxon can have more experiments (Bacteria has 791), so a longer
 * list is `or`-ed `in` chunks.
 */
export function experimentBiosetCollectionRql(experimentIds: string[]): string {
  const chunks: string[] = [];
  for (let start = 0; start < experimentIds.length; start += maxRqlInValues) {
    chunks.push(
      serializeRql("bioset", {
        operator: "in",
        field: "exp_id",
        values: experimentIds.slice(start, start + maxRqlInValues),
      }),
    );
  }
  return chunks.length === 1 ? chunks[0] : `or(${chunks.join(",")})`;
}

export function genomeExperimentRql(genomeId: string): string {
  return eq("experiment", "genome_id", genomeId);
}
