import { eq } from "@/lib/data-api";
import { toQueryString } from "@/lib/url";
import {
  serializeCollectionState,
  type CollectionState,
} from "@/lib/views/collection-state";
import { rqlAnd, rqlAnyOf } from "@/lib/views/rql";

import { genomeCollectionOptions } from "./query";

/** The Genomes tab an overview's charts link into. */
export interface GenomeListLink {
  pathname: string;
  params?: Readonly<Record<string, string>>;
  state?: CollectionState;
}

const unfilteredGenomeState: CollectionState = {
  filters: {},
  page: 1,
  sort: genomeCollectionOptions.defaultSort,
};

/**
 * `state` narrowed to genomes whose `field` is `value`, as a friendly filter shown as a removable chip.
 * Beside an explicit `rql` the value joins the rql instead of becoming a removable chip, so existing drill-down links keep working unchanged; making it a chip there too is a possible follow-up. `undefined` for a field with no filter.
 */
export function genomeStateWithValue(
  state: CollectionState,
  field: string,
  value: string,
): CollectionState | undefined {
  return genomeStateWithValues(state, field, [value]);
}

function genomeStateWithValues(
  state: CollectionState,
  field: string,
  values: readonly string[],
): CollectionState | undefined {
  if (!genomeCollectionOptions.friendlyFilters?.includes(field)) {
    return undefined;
  }
  if (state.rql) {
    const clauses = values.map((value) => eq("genome", field, value));
    return {
      ...state,
      rql: rqlAnd(state.rql, rqlAnyOf(clauses)),
      page: 1,
    };
  }
  return { ...state, filters: { ...state.filters, [field]: [...values] }, page: 1 };
}

/** Values no `eq` can select: a blank one, and one with a parenthesis, which the Data API answers with HTTP 400 however it is encoded. */
const unselectableValue = /^\s*$|[()]/;

export function genomeListValueHref(
  link: GenomeListLink,
  field: string,
  value: string,
): string | undefined {
  return genomeListValuesHref(link, field, [value]);
}

export function genomeListValuesHref(
  link: GenomeListLink,
  field: string,
  values: readonly string[],
): string | undefined {
  if (values.length === 0 || values.some((v) => unselectableValue.test(v))) {
    return undefined;
  }
  const state = genomeStateWithValues(
    link.state ?? unfilteredGenomeState,
    field,
    values,
  );
  if (!state) return undefined;
  const params = new URLSearchParams(link.params);
  for (const [name, selected] of serializeCollectionState(
    state,
    genomeCollectionOptions,
  )) {
    params.append(name, selected);
  }
  return `${link.pathname}?${toQueryString(params)}`;
}
