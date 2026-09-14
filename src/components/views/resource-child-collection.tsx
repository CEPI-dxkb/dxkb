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
import { dataSort, type CollectionState } from "@/lib/views/collection-state";
import {
  ResourceCollection,
  matchesLoadedKeyword,
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

function saveRows(
  rows: readonly ChildRow[],
  fields: readonly string[],
  format: "csv" | "txt",
  name: string,
) {
  const separator = format === "csv" ? "," : "\t";
  const value = (input: unknown) => {
    const text = Array.isArray(input)
      ? input.map(String).join("; ")
      : typeof input === "string" ||
          typeof input === "number" ||
          typeof input === "boolean" ||
          typeof input === "bigint"
        ? String(input)
        : input == null
          ? ""
          : JSON.stringify(input);
    const cleaned = text.replace(/\r\n|\n|\r/g, " ");
    if (format === "txt") return cleaned.replaceAll("\t", " ");
    const safe = /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const body = [
    fields.join(separator),
    ...rows.map((row) =>
      fields.map((field) => value(row[field])).join(separator),
    ),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([body]));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface ResourceChildCollectionProps {
  resource: DataResource;
  label: string;
  idField: string;
  rql: string;
  columns?: ResourceCollectionProfile<ChildRow>["columns"];
  defaultSort: string;
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
      defaultSort,
      basePredicate: rql,
      guideUrl,
    };
  }

  const exportColumns = profile.columns;
  return (
    <ResourceCollection
      profile={profile}
      repository={repository}
      state={effectiveState}
      onStateChange={handleStateChange}
      showHeader={false}
      keywordMode={keywordMode}
      loadedKeywordValue={keywordMode === "loaded" ? keywordValue : undefined}
      onLoadedKeywordChange={
        keywordMode === "loaded" ? onKeywordChange : undefined
      }
      keywordPlaceholder={keywordPlaceholder}
      onExport={async ({
        format,
        selectedIds,
        fields,
        rql: exportRql,
        loadedKeyword,
      }) => {
        const selectedFields = fields
          ? [...fields]
          : exportColumns.map((column) => column.id);
        if (selectedIds?.length) {
          const result = await repository.selected(resource, {
            ids: [...selectedIds],
            fields: selectedFields,
          });
          saveRows(result.rows, selectedFields, format, label.toLowerCase());
          return;
        }
        // A loaded-mode keyword filters rows client-side, so it never reaches the
        // request. Matching it here needs every profile column, not just the
        // requested export fields; the rows are projected back down afterwards.
        const result = await repository.exportAll(resource, {
          rql: exportRql ?? rql,
          keyword: effectiveState.keyword,
          fields: loadedKeyword
            ? exportColumns.map((column) => column.id)
            : selectedFields,
          sort: dataSort(effectiveState.sort),
        });
        const rows = loadedKeyword
          ? result.rows.filter((row) => matchesLoadedKeyword(row, loadedKeyword))
          : result.rows;
        saveRows(rows, selectedFields, format, label.toLowerCase());
      }}
    />
  );
}
