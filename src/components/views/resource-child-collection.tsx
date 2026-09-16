"use client";

import { useState } from "react";
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
import type { CollectionState } from "@/lib/views/collection-state";
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
  resource: DataResource;
  label: string;
  idField: string;
  rql: string;
  columns?: ResourceCollectionProfile<ChildRow>["columns"];
  defaultSort: string;
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
   *    does. Deleting the general mechanism while keeping four near-duplicate
   *    specializations is the wrong direction; folding them into it is the
   *    "collection wrapper adapter" the review plan deferred, because the
   *    `rowHref` casts those branches need keep it from being cast-free.
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
      key={`${props.resource}:${props.rql}`}
      {...props}
    />
  );
}

function ScopedResourceChildCollection({
  resource,
  label,
  idField,
  rql,
  columns,
  defaultSort,
  profile: suppliedProfile,
  guideUrl,
  keywordMode = "server",
  keywordValue,
  onKeywordChange,
  keywordPlaceholder,
}: ResourceChildCollectionProps) {
  const [state, setState] = useState<CollectionState>({
    filters: {},
    page: 1,
    sort: defaultSort,
  });
  const isControlledServerKeyword =
    keywordMode === "server" && keywordValue !== undefined;
  /**
   * A new keyword is a new result set, so the page index it was paged into no
   * longer means anything — page 3 of an unfiltered scope is routinely past the
   * end of the filtered one, which shows an empty table under a pager still
   * reading 3. `ResourceCollection` resets the page when its *own* keyword box
   * commits, but a keyword arriving as a prop (the sibling view's box committed)
   * never passes through `handleStateChange`, so this is the only place that
   * observes the transition. Render-phase update, like `GraphToolbar` and
   * `ResourceFilterBar`: the stale page is corrected before it can be requested.
   */
  const [previousKeywordValue, setPreviousKeywordValue] =
    useState(keywordValue);
  if (isControlledServerKeyword && previousKeywordValue !== keywordValue) {
    setPreviousKeywordValue(keywordValue);
    setState((current) =>
      current.page === 1 ? current : { ...current, page: 1 },
    );
  }
  // The controlled text is the single source of truth, so the local state never
  // holds a keyword of its own that could disagree with the sibling view's.
  const effectiveState = isControlledServerKeyword
    ? { ...state, keyword: keywordValue || undefined }
    : state;
  const handleStateChange = (next: CollectionState) => {
    if (!isControlledServerKeyword) {
      setState(next);
      return;
    }
    if ((next.keyword ?? "") !== (effectiveState.keyword ?? "")) {
      onKeywordChange?.(next.keyword ?? "");
    }
    setState({ ...next, keyword: undefined });
  };
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
      exportFileName: label.toLowerCase(),
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
      exportFileName: label.toLowerCase(),
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
      exportFileName: label.toLowerCase(),
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
      exportFileName: label.toLowerCase(),
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
      exportFileName: label.toLowerCase(),
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
      exportFileName: label.toLowerCase(),
    };
  }

  return (
    <ResourceCollection
      profile={profile}
      repository={repository}
      state={effectiveState}
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
