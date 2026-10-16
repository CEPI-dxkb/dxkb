import { eq } from "@/lib/data-api";
import { toQueryString } from "@/lib/url";
import {
  serializeCollectionState,
  type CollectionState,
} from "@/lib/views/collection-state";
import { rqlAnd } from "@/lib/views/rql";

import { genomeCollectionOptions } from "./query";

/**
 * The Genomes tab an overview's charts link into: the page that lists the
 * charted genomes, the parameters that open its Genomes tab, and that tab's
 * state, which each chart bucket narrows.
 */
export interface GenomeListLink {
  pathname: string;
  /** Selects the Genomes tab (`tab=genomes`); `/genome` opens it by default. */
  params?: Readonly<Record<string, string>>;
  /** The list's own query. A taxon's Genomes tab starts unfiltered. */
  state?: CollectionState;
}

const unfilteredGenomeState: CollectionState = {
  filters: {},
  page: 1,
  sort: genomeCollectionOptions.defaultSort,
};

/**
 * `state` narrowed to the genomes whose `field` is `value`, as a facet pick
 * selects them: a friendly filter, which the list shows as a removable chip,
 * in place of the field's other values. An explicit `rql` keeps friendly
 * filters out (`filtersBesideRql`), so beside one the value joins the rql.
 * `undefined` for a field the Genomes tab has no filter for.
 */
export function genomeStateWithValue(
  state: CollectionState,
  field: string,
  value: string,
): CollectionState | undefined {
  if (!genomeCollectionOptions.friendlyFilters?.includes(field)) {
    return undefined;
  }
  if (state.rql) {
    return {
      ...state,
      rql: rqlAnd(state.rql, eq("genome", field, value)),
      page: 1,
    };
  }
  return { ...state, filters: { ...state.filters, [field]: [value] }, page: 1 };
}

/**
 * Values no `eq` can select: a blank one (the "Unspecified" bucket), and one
 * with a parenthesis, which the Data API answers with HTTP 400 however it is
 * encoded (`eq(sequencing_centers,"Diseases%28USAMRIID%29")`).
 */
const unselectableValue = /^\s*$|[()]/;

/**
 * Where a chart bucket links: the Genomes tab listing the genomes `link`
 * covers whose `field` is `value`, or `undefined` for a value no filter can
 * select.
 */
export function genomeListValueHref(
  link: GenomeListLink,
  field: string,
  value: string,
): string | undefined {
  if (unselectableValue.test(value)) return undefined;
  const state = genomeStateWithValue(
    link.state ?? unfilteredGenomeState,
    field,
    value,
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
