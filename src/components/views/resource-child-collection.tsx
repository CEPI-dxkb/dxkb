"use client";

import { useState } from "react";
import { useChildCollectionUrlState } from "@/hooks/views/use-child-collection-url-state";
import type { DataTableRow } from "@/components/shared/data-table";
import {
  DataRepository,
  type DataResource,
  type DataSort,
} from "@/lib/data-api";
import type { CollectionDownloadSpec } from "@/lib/data-api/downloads";
import { epitopeCollectionProfile } from "@/lib/epitope-view";
import { featureCollectionProfile } from "@/lib/feature-view";
import { genomeAmrCollectionProfile } from "@/lib/genome-amr-view";
import { biosetCollectionProfile } from "@/lib/experiment-view/profile";
import { proteinFeatureCollectionProfile } from "@/lib/protein-feature-view";
import { proteinStructureCollectionProfile } from "@/lib/protein-structure-view";
import { serologyCollectionProfile } from "@/lib/serology-view";
import { strainCollectionProfile } from "@/lib/strain-view";
import { surveillanceCollectionProfile } from "@/lib/surveillance-view";
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
 * `ResourceCollection` uses `buildStructuralRql` instead of `basePredicate`
 * whenever it returns a clause, so each branch must `and` the parent rql back
 * in or a facet click widens the tab.
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

function scopedProfile<Row extends DataTableRow>(
  { rowHref, ...canonical }: ResourceCollectionProfile<Row>,
  label: string,
  rql: string,
): ResourceCollectionProfile<ChildRow> {
  return {
    ...canonical,
    label,
    basePredicate: rql,
    buildStructuralRql: scopedStructuralRql(rql, canonical.buildStructuralRql),
    rowHref: rowHref && ((row) => rowHref(row as Row)),
    exportFileName: label.toLowerCase(),
  };
}

const canonicalProfiles: Partial<
  Record<
    DataResource,
    (label: string, rql: string) => ResourceCollectionProfile<ChildRow>
  >
> = {
  bioset: (label, rql) => scopedProfile(biosetCollectionProfile, label, rql),
  epitope: (label, rql) => scopedProfile(epitopeCollectionProfile, label, rql),
  genome_amr: (label, rql) =>
    scopedProfile(genomeAmrCollectionProfile, label, rql),
  genome_feature: (label, rql) =>
    scopedProfile(featureCollectionProfile, label, rql),
  protein_feature: (label, rql) =>
    scopedProfile(proteinFeatureCollectionProfile, label, rql),
  protein_structure: (label, rql) =>
    scopedProfile(proteinStructureCollectionProfile, label, rql),
  serology: (label, rql) =>
    scopedProfile(serologyCollectionProfile, label, rql),
  strain: (label, rql) => scopedProfile(strainCollectionProfile, label, rql),
  surveillance: (label, rql) =>
    scopedProfile(surveillanceCollectionProfile, label, rql),
};

interface ResourceChildCollectionProps {
  urlKey: ChildCollectionUrlKey;
  resource: DataResource;
  label: string;
  idField: string;
  rql: string;
  columns?: ResourceCollectionProfile<ChildRow>["columns"];
  defaultSort: string;
  unsortedOrder?: DataSort;
  defaultFilters?: CollectionStateOptions["defaultFilters"];
  /**
   * Retained for the export-contract tests, which pin exact bytes against a
   * two-column profile; no production caller sets it.
   */
  profile?: ResourceCollectionProfile<ChildRow>;
  download?: CollectionDownloadSpec;
  guideUrl?: string;
  keywordMode?: "server" | "loaded";
  serverKeywordMode?: "exact" | "prefix";
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
  unsortedOrder,
  defaultFilters,
  profile: suppliedProfile,
  download,
  guideUrl,
  keywordMode = "server",
  serverKeywordMode,
  keywordValue,
  onKeywordChange,
  keywordPlaceholder,
}: ResourceChildCollectionProps) {
  const exportFileName = label.toLowerCase();
  const canonicalProfile = canonicalProfiles[resource];
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
  } else if (canonicalProfile) {
    profile = canonicalProfile(label, rql);
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
  if (unsortedOrder) profile = { ...profile, unsortedOrder };
  if (download) profile = { ...profile, download };

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
   * A keyword arriving as a prop never passes through `handleStateChange`, so
   * this is the only place that sees it; request page 1 until the owner drops
   * `<urlKey>.page`.
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
  const effectiveState = isControlledServerKeyword
    ? { ...pagedState, keyword: keywordValue || undefined }
    : pagedState;
  const handleStateChange = (next: CollectionState) => {
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
