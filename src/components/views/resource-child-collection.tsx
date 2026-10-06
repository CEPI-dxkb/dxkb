"use client";

import { useState } from "react";
import { useChildCollectionUrlState } from "@/hooks/views/use-child-collection-url-state";
import { DataRepository, type DataResource } from "@/lib/data-api";
import {
  featureCollectionProfile,
  type FeatureViewRecord,
} from "@/lib/feature-view";
import { biosetCollectionProfile } from "@/lib/experiment-view/profile";
import {
  proteinFeatureCollectionProfile,
  type ProteinFeatureViewRecord,
} from "@/lib/protein-feature-view";
import {
  proteinStructureCollectionProfile,
  type ProteinStructureViewRecord,
} from "@/lib/protein-structure-view";
import {
  childCollectionOptions,
  type ChildCollectionUrlKey,
} from "@/lib/views/child-collection-state";
import {
  facetCountState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import {
  ResourceCollection,
  type ResourceCollectionProfile,
} from "./resource-collection";

const repository = new DataRepository();
type ChildRow = Record<string, unknown>;

/**
 * Keep a child collection pinned to its parent scope. `ResourceCollection` uses
 * `buildStructuralRql` *instead of* `basePredicate` whenever the builder returns a
 * clause, so every branch that reuses a resource's own collection profile has to
 * `and`-compose the parent `rql` back in — otherwise the first facet click would
 * silently widen the tab to every parent.
 */
function scopedStructuralRql(
  rql: string,
  buildStructuralRql?: (state: CollectionState) => string | undefined,
) {
  return (state: CollectionState) => {
    const structuralRql = buildStructuralRql?.(state);
    return structuralRql ? `and(${rql},${structuralRql})` : rql;
  };
}

interface ResourceChildCollectionProps {
  /**
   * Prefix for this table's URL params, e.g. "features" → `features.page`. Unique
   * among the tables that can be on screen together.
   */
  urlKey: ChildCollectionUrlKey;
  resource: DataResource;
  label: string;
  idField: string;
  rql: string;
  columns?: ResourceCollectionProfile<ChildRow>["columns"];
  defaultSort: string;
  /**
   * Filters this table selects while its own URL params do not name them,
   * removable like any facet value; `<urlKey>.<name>=*` records the removal.
   * The Genome list's and Genome page's Features tabs pass
   * `featureListDefaultFilters`.
   */
  defaultFilters?: CollectionStateOptions["defaultFilters"];
  /**
   * Explicit collection profile, overriding the per-`resource` dispatch below.
   *
   * No production caller sets this today — every real child tab lands on one of
   * the four `resource === …` branches or on the raw-`columns` fallback. It is
   * retained deliberately, for two reasons:
   *
   * 1. It is the *general* form those four branches specialize. Each of them
   *    spreads a canonical profile and overrides `label`, `basePredicate`,
   *    `buildStructuralRql` and `exportFileName` — exactly what this branch
   *    does. The `rowHref` casts those branches need currently prevent them
   *    from sharing this branch without weakening their row types.
   * 2. It is the seam the export-contract tests need. The byte-identical
   *    CSV/TSV assertions in `__tests__/resource-child-collection.test.tsx` pin
   *    exact bytes against a two-column profile; routed through
   *    `resource="protein_structure"` they would inherit the canonical
   *    metadata-derived column set and break on any unrelated field change.
   */
  profile?: ResourceCollectionProfile<ChildRow>;
  guideUrl?: string;
  // Matches ResourceCollection's own default. Pass "loaded" only where the caller
  // owns the keyword box and wants it to filter the current page client-side.
  keywordMode?: "server" | "loaded";
  /**
   * How this table's own keyword reaches the Data API, for export and
   * select-all as well as the rows. The Genome list passes "exact" so its
   * related tabs' keyword box sends `keyword(...)` like the list's own, as legacy
   * GenomeList does; unset keeps the profile's mode (the token-prefix default).
   */
  serverKeywordMode?: "exact" | "prefix";
  /**
   * Controlled keyword text, for a caller that shares one keyword box with a
   * sibling view (the Interactions shell shares it with the Graph). In the
   * default "server" mode this text is a request predicate, so it is fed into
   * the collection state rather than used as a client-side filter, and edits are
   * reported back out instead of being kept here.
   */
  keywordValue?: string;
  onKeywordChange?: (value: string) => void;
  keywordPlaceholder?: string;
}

export function ResourceChildCollection(props: ResourceChildCollectionProps) {
  return (
    <ScopedResourceChildCollection
      key={`${props.urlKey}:${props.resource}:${props.rql}`}
      {...props}
    />
  );
}

function ScopedResourceChildCollection({
  urlKey,
  resource,
  label,
  idField,
  rql,
  columns,
  defaultSort,
  defaultFilters,
  profile: suppliedProfile,
  guideUrl,
  keywordMode = "server",
  serverKeywordMode,
  keywordValue,
  onKeywordChange,
  keywordPlaceholder,
}: ResourceChildCollectionProps) {
  const exportFileName = label.toLowerCase();
  let profile: ResourceCollectionProfile<ChildRow>;
  if (suppliedProfile) {
    profile = {
      ...suppliedProfile,
      label,
      basePredicate: rql,
      buildStructuralRql: scopedStructuralRql(
        rql,
        suppliedProfile.buildStructuralRql,
      ),
      exportFileName,
    };
  } else if (resource === "bioset") {
    profile = {
      ...biosetCollectionProfile,
      label,
      basePredicate: rql,
      buildStructuralRql: scopedStructuralRql(
        rql,
        biosetCollectionProfile.buildStructuralRql,
      ),
      exportFileName,
    };
  } else if (resource === "genome_feature") {
    profile = {
      ...featureCollectionProfile,
      label,
      basePredicate: rql,
      buildStructuralRql: scopedStructuralRql(
        rql,
        featureCollectionProfile.buildStructuralRql,
      ),
      rowHref: (row) =>
        featureCollectionProfile.rowHref?.(row as FeatureViewRecord),
      exportFileName,
    };
  } else if (resource === "protein_feature") {
    profile = {
      ...proteinFeatureCollectionProfile,
      label,
      basePredicate: rql,
      buildStructuralRql: scopedStructuralRql(
        rql,
        proteinFeatureCollectionProfile.buildStructuralRql,
      ),
      rowHref: (row) =>
        proteinFeatureCollectionProfile.rowHref?.(
          row as ProteinFeatureViewRecord,
        ),
      exportFileName,
    };
  } else if (resource === "protein_structure") {
    profile = {
      ...proteinStructureCollectionProfile,
      label,
      basePredicate: rql,
      buildStructuralRql: scopedStructuralRql(
        rql,
        proteinStructureCollectionProfile.buildStructuralRql,
      ),
      rowHref: (row) =>
        proteinStructureCollectionProfile.rowHref?.(
          row as ProteinStructureViewRecord,
        ),
      exportFileName,
    };
  } else {
    if (!columns) {
      throw new Error(
        `Columns are required for ${resource} child collections.`,
      );
    }
    profile = {
      resource,
      label,
      idField,
      columns,
      basePredicate: rql,
      guideUrl,
      exportFileName,
    };
  }
  if (serverKeywordMode) profile = { ...profile, serverKeywordMode };

  const collectionOptions = childCollectionOptions(
    profile.columns,
    profile.facets,
    defaultSort,
    defaultFilters,
  );
  const [state, setState] = useChildCollectionUrlState(
    urlKey,
    collectionOptions,
  );
  const isControlledServerKeyword =
    keywordMode === "server" && keywordValue !== undefined;
  /**
   * A new keyword is a new result set, so the page index it was paged into no
   * longer means anything — page 3 of an unfiltered scope is routinely past the
   * end of the filtered one, which shows an empty table under a pager still
   * reading 3. `ResourceCollection` resets the page when its *own* keyword box
   * commits, but a keyword arriving as a prop (the sibling view's box committed)
   * never passes through `handleStateChange`, so this is the only place that
   * observes the transition.
   *
   * The page lives in the URL now, and writing the URL during render is not
   * possible, so the keyword's owner drops `<urlKey>.page` in the same event
   * (`resetChildCollectionPage`). Until that update reaches `state`, request page 1
   * so the stale page is never fetched. Render-phase state, like `GraphToolbar` and
   * `ResourceFilterBar`.
   */
  const [previousKeywordValue, setPreviousKeywordValue] =
    useState(keywordValue);
  const [awaitingPageReset, setAwaitingPageReset] = useState(false);
  if (isControlledServerKeyword && previousKeywordValue !== keywordValue) {
    setPreviousKeywordValue(keywordValue);
    setAwaitingPageReset(true);
  }
  if (awaitingPageReset && state.page === 1) setAwaitingPageReset(false);
  const pagedState = awaitingPageReset ? { ...state, page: 1 } : state;
  // The controlled text is the single source of truth, so the URL never holds a
  // keyword of its own that could disagree with the sibling view's.
  const effectiveState = isControlledServerKeyword
    ? { ...pagedState, keyword: keywordValue || undefined }
    : pagedState;
  const handleStateChange = (next: CollectionState) => {
    // The user is moving on from whatever page the reset was waiting to clear.
    setAwaitingPageReset(false);
    if (!isControlledServerKeyword) {
      setState(next);
      return;
    }
    if ((next.keyword ?? "") !== (effectiveState.keyword ?? "")) {
      onKeywordChange?.(next.keyword ?? "");
    }
    setState({ ...next, keyword: undefined });
  };

  return (
    <ResourceCollection
      profile={profile}
      repository={repository}
      state={effectiveState}
      facetState={facetCountState(effectiveState, collectionOptions)}
      onStateChange={handleStateChange}
      keywordMode={keywordMode}
      loadedKeywordValue={keywordMode === "loaded" ? keywordValue : undefined}
      onLoadedKeywordChange={
        keywordMode === "loaded" ? onKeywordChange : undefined
      }
      keywordPlaceholder={keywordPlaceholder}
    />
  );
}
