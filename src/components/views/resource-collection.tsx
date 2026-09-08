"use client";

import { useState, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfoPanel } from "@/components/detail-panel/info-panel";
import { SearchActionBar } from "@/components/search/search-action-bar";
import { ResourceFilterBar } from "./resource-filter-bar";
import { downloadResourceExport } from "./resource-export";
import { ResourceWorkspace } from "./resource-workspace";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/shared/data-table";
import { useResourceCollection } from "@/hooks/views/use-resource-collection";
import type { CollectionState } from "@/lib/views/collection-state";
import { rqlKeyword } from "@/lib/views/rql";
import { resourceCollectionPageSize } from "@/hooks/views/collection-state";
import {
  maxExportRows,
  type DataRepository,
  type DataResource,
} from "@/lib/data-api";
import {
  biosetResultsHref,
  epitopeHref,
  epitopeIdFromRow,
  experimentHref,
  experimentIdFromRow,
  featureHref,
  featureIdFromRow,
  genomeHref,
  genomeIdFromRow,
  genomesHrefFromRow,
  proteinStructureHref,
} from "@/lib/views/hrefs";

export interface ResourceCollectionFacet {
  field: string;
  label: string;
  initiallyVisible?: boolean;
}

export interface ResourceCollectionProfile<Row extends DataTableRow> {
  resource: DataResource;
  label: string;
  idField: string;
  columns: readonly DataTableColumn[];
  detailFields?: readonly string[];
  defaultSort: string;
  guideUrl?: string;
  basePredicate?: string;
  buildStructuralRql?: (state: CollectionState) => string | undefined;
  facets?: readonly ResourceCollectionFacet[];
  rowHref?: (row: Row) => string | undefined;
  rowLinkField?: string;
}

function combinePredicates(...predicates: (string | undefined)[]) {
  const active = predicates.filter((predicate): predicate is string =>
    Boolean(predicate),
  );
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  return `and(${active.join(",")})`;
}

function matchesLoadedKeyword(row: DataTableRow, keyword: string) {
  return Object.values(row).some((value) => {
    const values = Array.isArray(value) ? value : [value];
    return values.some((item) =>
      String(item ?? "")
        .toLowerCase()
        .includes(keyword),
    );
  });
}

export interface ResourceCollectionExportRequest {
  format: "csv" | "txt";
  selectedIds?: readonly string[];
  fields: readonly string[] | null;
  rql?: string;
}

export interface ResourceCollectionProps<Row extends DataTableRow> {
  profile: ResourceCollectionProfile<Row>;
  repository: DataRepository;
  state: CollectionState;
  onStateChange: (state: CollectionState) => void;
  baseRql?: string;
  enableRowLinks?: boolean;
  renderDetail?: (row: Row) => ReactNode;
  showHeader?: boolean;
  keywordMode?: "server" | "loaded" | "refine";
  prefetchNextPage?: boolean;
  onExport?: (request: ResourceCollectionExportRequest) => void | Promise<void>;
}

export function ResourceCollection<Row extends DataTableRow>({
  profile,
  repository,
  state,
  onStateChange,
  baseRql,
  enableRowLinks = true,
  renderDetail,
  showHeader = true,
  keywordMode = "server",
  prefetchNextPage = false,
  onExport,
}: ResourceCollectionProps<Row>) {
  const [exportError, setExportError] = useState<string | null>(null);
  const [biosetActionError, setBiosetActionError] = useState<string | null>(
    null,
  );
  const [selectedRowsById, setSelectedRowsById] = useState<
    Partial<Record<string, Row>>
  >({});
  const [loadedKeyword, setLoadedKeyword] = useState("");
  const normalizedLoadedKeyword = loadedKeyword.trim().toLowerCase();
  const hasLoadedKeyword =
    keywordMode === "loaded" && Boolean(normalizedLoadedKeyword);
  const refinementRql =
    keywordMode === "refine" && state.refine?.trim()
      ? rqlKeyword(state.refine.trim())
      : undefined;
  const [columnVisibility, setColumnVisibility] = useState(() =>
    Object.fromEntries(
      profile.columns.map((column) => [column.id, column.visible !== false]),
    ),
  );
  const structuralRql = combinePredicates(
    baseRql,
    profile.buildStructuralRql?.(state) ?? profile.basePredicate,
    refinementRql,
  );
  const effectiveRql = combinePredicates(structuralRql, state.rql);
  const requestState =
    keywordMode === "loaded" ? { ...state, keyword: undefined } : state;
  const collection = useResourceCollection({
    repository,
    resource: profile.resource,
    idField: profile.idField,
    fields: profile.columns.map((column) => column.id),
    detailFields: profile.detailFields,
    facetFields: profile.facets?.map((facet) => facet.field),
    prefetchNextPage,
    structuralRql,
    state: requestState,
    onStateChange:
      keywordMode === "loaded"
        ? (nextState) => {
            onStateChange({ ...nextState, keyword: state.keyword });
          }
        : onStateChange,
  });
  const columns = profile.columns.map((column) =>
    enableRowLinks &&
    column.id === (profile.rowLinkField ?? profile.idField) &&
    profile.rowHref
      ? {
          ...column,
          href: profile.rowHref as (row: DataTableRow) => string | undefined,
        }
      : column,
  );
  const displayedRows = hasLoadedKeyword
    ? collection.rows.filter((row) =>
        matchesLoadedKeyword(row, normalizedLoadedKeyword),
      )
    : collection.rows;
  const displayedTotal = hasLoadedKeyword
    ? displayedRows.length
    : collection.total;
  const displayedIds = hasLoadedKeyword
    ? displayedRows.map((row) => String(row[profile.idField]))
    : undefined;
  const displayedIdSet = new Set(displayedIds);
  const displayedSelectedIds = hasLoadedKeyword
    ? collection.selectedIds.filter((id) => displayedIdSet.has(id))
    : collection.selectedIds;
  const displayedSelection = hasLoadedKeyword
    ? Object.fromEntries(displayedSelectedIds.map((id) => [id, true as const]))
    : collection.selection;
  const detail = collection.detail as Row | null;
  const isDetailDisplayed =
    !hasLoadedKeyword ||
    (collection.activeId !== null && displayedIdSet.has(collection.activeId));
  const displayedDetail = isDetailDisplayed ? detail : null;
  const selectedGenomeId =
    profile.resource === "genome"
      ? isDetailDisplayed
        ? collection.activeId
        : null
      : genomeIdFromRow(displayedDetail);
  const selectedGenomesHref = genomesHrefFromRow(displayedDetail);
  const selectedFeatureId = featureIdFromRow(displayedDetail);
  const selectedEpitopeId = epitopeIdFromRow(displayedDetail);
  const selectedExperimentId = experimentIdFromRow(displayedDetail);
  const selectedPdbId = displayedDetail?.pdb_id;
  const selectedStructureHref =
    profile.resource === "protein_structure" &&
    (typeof selectedPdbId === "string" || typeof selectedPdbId === "number")
      ? proteinStructureHref(selectedPdbId)
      : undefined;
  const selectedMemberHref = displayedDetail
    ? profile.rowHref?.(displayedDetail)
    : undefined;
  const selectedBiosetExperimentIds = collection.selectedIds.flatMap((id) => {
    const selectedRow =
      selectedRowsById[id] ??
      displayedRows.find((row) => String(row[profile.idField]) === id);
    const experimentId = experimentIdFromRow(selectedRow ?? null);
    return experimentId ? [experimentId] : [];
  });
  const hasCompleteBiosetSelection =
    selectedBiosetExperimentIds.length > 0 &&
    selectedBiosetExperimentIds.length === collection.selectedIds.length;
  const hasBiosetSelection =
    profile.resource === "bioset" &&
    (collection.isAllPagesSelected || hasCompleteBiosetSelection);
  const hasIncompleteBiosetSelection =
    profile.resource === "bioset" &&
    !collection.isAllPagesSelected &&
    collection.selectedIds.length > 0 &&
    !hasCompleteBiosetSelection;

  const openBiosetResults = async () => {
    setBiosetActionError(null);
    if (!collection.isAllPagesSelected) {
      window.open(
        biosetResultsHref(selectedBiosetExperimentIds),
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (collection.total > maxExportRows) {
      setBiosetActionError(
        `This selection contains ${collection.total.toLocaleString()} Biosets. Narrow the results to ${maxExportRows.toLocaleString()} or fewer and try again.`,
      );
      return;
    }
    const resultsWindow = window.open("about:blank", "_blank");
    if (!resultsWindow) {
      setBiosetActionError(
        "Allow pop-ups to open the selected Bioset results.",
      );
      return;
    }
    resultsWindow.opener = null;
    try {
      const result = await repository.exportAll(profile.resource, {
        rql: effectiveRql,
        keyword: requestState.keyword,
        fields: ["exp_id"],
        sort:
          state.sort === "unsorted"
            ? undefined
            : {
                field: state.sort.split(":")[0],
                direction: state.sort.endsWith(":desc") ? "desc" : "asc",
              },
      });
      const experimentIds = result.rows.flatMap((row) => {
        const experimentId = experimentIdFromRow(row);
        return experimentId ? [experimentId] : [];
      });
      if (experimentIds.length !== result.rows.length) {
        resultsWindow.close();
        setBiosetActionError(
          experimentIds.length === 0
            ? "No experiments are associated with this selection."
            : "Some selected Biosets are not associated with experiments.",
        );
        return;
      }
      resultsWindow.location.replace(biosetResultsHref(experimentIds));
    } catch (error) {
      resultsWindow.close();
      setBiosetActionError(
        error instanceof Error
          ? error.message
          : "The selected Bioset results could not be loaded.",
      );
    }
  };

  const exportRows = async (
    format: "csv" | "txt",
    selectedIds?: readonly string[],
    fields: readonly string[] | null = null,
    isAllPagesSelected = false,
  ) => {
    setExportError(null);
    const ids = isAllPagesSelected ? undefined : selectedIds;
    if (ids && ids.length === 0) return;
    if (!ids && collection.isRefreshing) {
      setExportError(
        "Wait for the current results to finish loading before exporting.",
      );
      return;
    }
    if (!ids?.length && collection.total > maxExportRows) {
      setExportError(
        `This export matches ${collection.total.toLocaleString()} rows. Narrow the results to ${maxExportRows.toLocaleString()} rows or fewer and try again.`,
      );
      return;
    }
    try {
      if (onExport) {
        await onExport({ format, selectedIds: ids, fields, rql: effectiveRql });
        return;
      }
      const selectedFields = fields
        ? [...fields]
        : profile.columns.map((column) => column.id);
      const allFields = profile.columns.map((column) => column.id);
      const result = ids?.length
        ? await repository.selected(profile.resource, {
            ids: [...ids],
            fields: selectedFields,
          })
        : await repository.exportAll(profile.resource, {
            rql: effectiveRql,
            keyword: requestState.keyword,
            fields: hasLoadedKeyword ? allFields : selectedFields,
            sort:
              state.sort === "unsorted"
                ? undefined
                : {
                    field: state.sort.split(":")[0],
                    direction: state.sort.endsWith(":desc") ? "desc" : "asc",
                  },
          });
      const exportedRows =
        hasLoadedKeyword && !ids
          ? result.rows.filter((row) =>
              matchesLoadedKeyword(row, normalizedLoadedKeyword),
            )
          : result.rows;
      downloadResourceExport(
        profile.resource,
        exportedRows,
        profile.columns,
        selectedFields,
        format,
      );
    } catch (error) {
      console.error("Resource export failed:", error);
      setExportError(
        "The requested export could not be created. Please try again.",
      );
    }
  };

  const detailContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-background text-foreground shadow-md">
        {collection.detailError ? (
          <Alert variant="destructive" className="m-4">
            <AlertTitle>Could not load record details</AlertTitle>
            <AlertDescription>
              {collection.detailError instanceof Error
                ? collection.detailError.message
                : String(collection.detailError)}
            </AlertDescription>
          </Alert>
        ) : renderDetail && displayedDetail ? (
          renderDetail(displayedDetail)
        ) : (
          <InfoPanel
            variant="search"
            activeTab={profile.resource}
            selectedIds={displayedSelectedIds}
            selectedRow={displayedDetail}
            isLoading={collection.isDetailLoading && isDetailDisplayed}
            isAllPagesSelected={
              hasLoadedKeyword ? false : collection.isAllPagesSelected
            }
            totalItems={displayedTotal}
          />
        )}
      </div>
    </div>
  );

  return (
    <section
      aria-label={showHeader ? undefined : profile.label}
      aria-labelledby={
        showHeader ? `${profile.resource}-collection-title` : undefined
      }
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {showHeader && (
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1
              id={`${profile.resource}-collection-title`}
              className="text-xl font-semibold"
            >
              {profile.label}
            </h1>
            <p className="text-sm text-muted-foreground">
              Browse {profile.label.toLowerCase()} records.
            </p>
          </div>
          {profile.guideUrl && (
            <a
              className="text-sm text-primary underline underline-offset-2"
              href={profile.guideUrl}
              target="_blank"
              rel="noreferrer"
            >
              Field guide
            </a>
          )}
        </header>
      )}

      <ResourceFilterBar
        keyword={
          keywordMode === "server"
            ? state.keyword
            : keywordMode === "refine"
              ? state.refine
              : loadedKeyword
        }
        filters={state.filters}
        facets={collection.facets}
        definitions={profile.facets ?? []}
        hasExplicitRql={Boolean(state.rql)}
        onChange={({ keyword, filters, clearRql }) => {
          if (keywordMode === "loaded") {
            const nextLoadedKeyword = keyword ?? "";
            if (nextLoadedKeyword !== loadedKeyword) {
              collection.setSelection({});
              collection.setIsAllPagesSelected(false);
            }
            setLoadedKeyword(nextLoadedKeyword);
            if (filters === state.filters && !clearRql) return;
          }
          onStateChange({
            ...state,
            keyword: keywordMode === "server" ? keyword : state.keyword,
            refine: keywordMode === "refine" ? keyword : state.refine,
            filters: state.rql && !clearRql ? state.filters : filters,
            rql: clearRql ? undefined : state.rql,
            page: 1,
          });
        }}
      />
      <span className="sr-only" aria-live="polite">
        {collection.isRefreshing
          ? "Refreshing results..."
          : `${String(displayedTotal)} results`}
      </span>

      {exportError && (
        <Alert variant="destructive">
          <AlertTitle>
            Could not export {profile.label.toLowerCase()}
          </AlertTitle>
          <AlertDescription>{exportError}</AlertDescription>
        </Alert>
      )}
      {biosetActionError && (
        <Alert variant="destructive">
          <AlertTitle>Could not open Bioset results</AlertTitle>
          <AlertDescription>{biosetActionError}</AlertDescription>
        </Alert>
      )}

      {collection.error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load {profile.label.toLowerCase()}</AlertTitle>
          <AlertDescription>
            <p>
              {collection.error instanceof Error
                ? collection.error.message
                : String(collection.error)}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void collection.refetch();
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <ResourceWorkspace
          hasSidePanel={
            hasLoadedKeyword
              ? displayedSelectedIds.length > 0
              : collection.isAllPagesSelected ||
                collection.selectedIds.length > 0
          }
          actionBar={
            <SearchActionBar
              selectedCount={
                hasLoadedKeyword
                  ? displayedSelectedIds.length
                  : collection.isAllPagesSelected
                    ? collection.total
                    : collection.selectedIds.length
              }
              searchType={profile.resource}
              guideUrl={profile.guideUrl}
              enabledActions={
                profile.resource === "strain" && selectedGenomesHref
                  ? ["genomes"]
                  : profile.resource === "protein_structure" &&
                      selectedStructureHref
                    ? ["structure"]
                    : hasBiosetSelection
                      ? ["biosets"]
                      : undefined
              }
              disabledActions={
                profile.resource === "strain" && !selectedGenomesHref
                  ? { genomes: "No genomes are associated with this strain" }
                    : profile.resource === "protein_structure"
                      ? {
                          genome: selectedGenomeId
                            ? undefined
                            : "No genome is associated with this structure",
                          feature: selectedFeatureId
                            ? undefined
                            : "No feature is associated with this structure",
                          structure: selectedStructureHref
                            ? undefined
                            : "A structure accession is required",
                        }
                      : hasIncompleteBiosetSelection
                        ? {
                            biosets:
                              "Some selected Biosets are not associated with experiments",
                          }
                        : undefined

              }
              onAction={(actionId) => {
                if (actionId === "download") {
                  void exportRows(
                    "csv",
                    displayedSelectedIds,
                    null,
                    collection.isAllPagesSelected,
                  );
                } else if (actionId === "biosets" && hasBiosetSelection) {
                  void openBiosetResults();
                } else if (actionId === "genome" && selectedGenomeId) {
                  window.open(
                    genomeHref(selectedGenomeId),
                    "_blank",
                    "noopener,noreferrer",
                  );
                } else if (actionId === "genomes" && selectedGenomesHref) {
                  window.open(
                    selectedGenomesHref,
                    "_blank",
                    "noopener,noreferrer",
                  );
                } else if (actionId === "feature" && selectedFeatureId) {
                  window.open(
                    featureHref(selectedFeatureId),
                    "_blank",
                    "noopener,noreferrer",
                  );
                } else if (actionId === "structure" && selectedStructureHref) {
                  window.open(
                    selectedStructureHref,
                    "_blank",
                    "noopener,noreferrer",
                  );
                } else if (actionId === "epitope" && selectedEpitopeId) {
                  window.open(
                    epitopeHref(selectedEpitopeId),
                    "_blank",
                    "noopener,noreferrer",
                  );
                } else if (actionId === "experiment" && selectedExperimentId) {
                  window.open(
                    experimentHref(selectedExperimentId),
                    "_blank",
                    "noopener,noreferrer",
                  );
                } else if (
                  (actionId === "surveillance" || actionId === "serology") &&
                  selectedMemberHref
                ) {
                  window.open(
                    selectedMemberHref,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }
              }}
            />
          }
          sidePanel={detailContent}
        >
          <DataTable
            id={`${profile.resource}-collection`}
            resource={profile.resource}
            idField={profile.idField}
            data={displayedRows}
            columns={columns}
            totalItems={displayedTotal}
            pageIndex={hasLoadedKeyword ? 0 : state.page - 1}
            pageSize={resourceCollectionPageSize}
            sorting={collection.sorting}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            rowSelection={displayedSelection}
            selectedIds={displayedSelectedIds}
            isAllPagesSelected={
              hasLoadedKeyword ? false : collection.isAllPagesSelected
            }
            onAllPagesSelectionChange={(selected) => {
              collection.setIsAllPagesSelected(selected);
              if (selected) collection.setSelection({});
            }}
            totalSelectedCount={
              hasLoadedKeyword
                ? displayedSelectedIds.length
                : collection.isAllPagesSelected
                  ? collection.total
                  : collection.selectedIds.length
            }
            onPageChange={collection.setPageIndex}
            onSortingChange={collection.setSorting}
            onRowSelectionChange={(selection) => {
              collection.setSelection(selection);
              setSelectedRowsById((current) => {
                const next: Record<string, Row> = {};
                for (const id of Object.keys(selection)) {
                  const selectedRow =
                    (displayedRows.find(
                      (row) => String(row[profile.idField]) === id,
                    ) as Row | undefined) ?? current[id];
                  if (selectedRow) next[id] = selectedRow;
                }
                return next;
              });
            }}
            onDownloadAll={(format, fields) =>
              exportRows(format, undefined, fields)
            }
            onDownloadSelected={(format, ids, fields) =>
              exportRows(format, ids, fields)
            }
            scrollRegionLabel={`${profile.label} results table`}
            isLoading={collection.isInitialLoading}
          />
        </ResourceWorkspace>
      )}
    </section>
  );
}
