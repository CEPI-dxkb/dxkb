"use client";

import { useState, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfoPanel } from "@/components/detail-panel/info-panel";
import {
  SearchActionBar,
  type SearchActionId,
} from "@/components/search/search-action-bar";
import { ResourceFilterBar } from "./resource-filter-bar";
import { downloadResourceExport } from "./resource-export";
import { ResourceWorkspace } from "./resource-workspace";
import {
  CollectionSelectionActions,
  copyAndServicesSelectionActionIds,
  featureSelectionActionIds,
  interactionSelectionActionIds,
  genomeSelectionActionIds,
  sequenceSelectionActionIds,
  servicesOnlySelectionActionIds,
  strainSelectionActionIds,
} from "./collection-selection-actions";
import type { SelectionServiceKind } from "./selection-service-chooser";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/shared/data-table";
import { useResourceCollection } from "@/hooks/views/use-resource-collection";
import { dataSort, type CollectionState } from "@/lib/views/collection-state";
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
  featureListHref,
  genomeHref,
  genomeIdFromRow,
  proteinStructureHref,
  taxonomyHref,
} from "@/lib/views/hrefs";
import {
  maxTaxonomyActionIds,
  normalizeTaxonIds,
  taxonomyActionLimitMessage,
  taxonomyFeaturesHref,
  taxonomyGenomesHref,
} from "@/lib/taxonomy-view";
import { TaxonomyServiceChooser } from "./taxonomy-service-chooser";
import { genomeIdsFromStrains } from "@/lib/strain-view";

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
  rowLinkFields?: readonly string[];
  serverKeywordMode?: "exact" | "prefix";
}

/** Actions each resource enables. Read by both visibility and dispatch. */
const taxonomyActionIds = [
  "services",
  "taxonOverview",
  "genomes",
  "features",
] as const satisfies readonly SearchActionId[];

const enabledActionsByResource: Partial<
  Record<DataResource, readonly SearchActionId[]>
> = {
  taxonomy: taxonomyActionIds,
  // Every resource in selectionActionsConfigByResource lives with
  // CollectionSelectionActions instead, which owns its bar.
};

/**
 * Resources whose selection actions live with `CollectionSelectionActions`.
 * `idField` names the row field SERVICES, GENOMES and GROUP resolve from and `idKind`
 * says what it holds, so both are inert where `hasSelectableServices` is false and no
 * ID-backed action is owned. `extraEnabledActionIds` lists entries this component
 * dispatches but the shared config disables by default.
 */
const selectionActionsConfigByResource = {
  strain: {
    searchType: "strain",
    actionIds: strainSelectionActionIds,
    extraEnabledActionIds: [],
    idField: "genome_ids",
    idKind: "genome",
    singularLabel: "Strain",
    hasSelectableServices: true,
  },
  genome: {
    searchType: "genome",
    actionIds: genomeSelectionActionIds,
    extraEnabledActionIds: [],
    idField: "genome_id",
    idKind: "genome",
    singularLabel: "Genome",
    hasSelectableServices: true,
  },
  genome_feature: {
    searchType: "genome_feature",
    actionIds: featureSelectionActionIds,
    // DWNLD, FEATURE and GENOME are enabled by default; FASTA and ID MAP stay
    // disabled until a later PR wires them.
    extraEnabledActionIds: [],
    idField: "feature_id",
    idKind: "feature",
    singularLabel: "Feature",
    hasSelectableServices: true,
  },
  genome_sequence: {
    searchType: "genome_sequence",
    actionIds: sequenceSelectionActionIds,
    // DWNLD and GENOME are enabled by default; FEATURES is not, and FASTA and Browser
    // stay disabled until a later PR wires them.
    extraEnabledActionIds: ["features"],
    idField: "genome_id",
    idKind: "genome",
    singularLabel: "Sequence",
    hasSelectableServices: true,
  },
  protein_feature: {
    searchType: "protein_feature",
    actionIds: copyAndServicesSelectionActionIds,
    extraEnabledActionIds: [],
    idField: "genome_id",
    idKind: "genome",
    // "Domains and Motifs" has no plural suffix to strip.
    singularLabel: "Domain or Motif",
    hasSelectableServices: false,
  },
  protein_structure: {
    searchType: "protein_structure",
    actionIds: copyAndServicesSelectionActionIds,
    extraEnabledActionIds: [],
    idField: "genome_id",
    idKind: "genome",
    singularLabel: "Protein Structure",
    hasSelectableServices: false,
  },
  sequence_feature: {
    searchType: "sequence_feature",
    actionIds: copyAndServicesSelectionActionIds,
    // DWNLD is enabled by default; VARIANT TYPES stays disabled until a later PR
    // wires it.
    extraEnabledActionIds: [],
    idField: "id",
    idKind: "genome",
    singularLabel: "Sequence Feature",
    hasSelectableServices: false,
  },
  epitope: {
    searchType: "epitope",
    actionIds: copyAndServicesSelectionActionIds,
    // DWNLD and EPITOPE are enabled by default.
    extraEnabledActionIds: [],
    idField: "epitope_id",
    idKind: "genome",
    singularLabel: "Epitope",
    hasSelectableServices: false,
  },
  serology: {
    searchType: "serology",
    actionIds: copyAndServicesSelectionActionIds,
    // DWNLD and SEROLOGY are enabled by default.
    extraEnabledActionIds: [],
    idField: "id",
    idKind: "genome",
    // "Serology" is already the singular the copied-rows toast wants.
    singularLabel: "Serology",
    hasSelectableServices: false,
  },
  surveillance: {
    searchType: "surveillance",
    actionIds: copyAndServicesSelectionActionIds,
    // DWNLD and SRVLNCE are enabled by default; MAP stays disabled until a later
    // PR wires it.
    extraEnabledActionIds: [],
    idField: "id",
    idKind: "genome",
    // "Surveillance" is already the singular the copied-rows toast wants.
    singularLabel: "Surveillance",
    hasSelectableServices: false,
  },
  ppi: {
    searchType: "ppi",
    actionIds: interactionSelectionActionIds,
    // DWNLD is enabled by default; FASTA stays disabled until a later PR wires it.
    extraEnabledActionIds: [],
    // One Interaction row names two interactors, and legacy's FEATURES and GROUP both
    // pool them.
    idField: ["feature_id_a", "feature_id_b"],
    idKind: "feature",
    singularLabel: "Interaction",
    hasSelectableServices: false,
  },
  experiment: {
    searchType: "experiment",
    actionIds: servicesOnlySelectionActionIds,
    // DWNLD and EXPRMNT are enabled by default; BIOSETS stays disabled until a
    // later PR wires the experiment-side gene list.
    extraEnabledActionIds: [],
    idField: "exp_id",
    idKind: "genome",
    singularLabel: "Experiment",
    hasSelectableServices: false,
  },
  bioset: {
    searchType: "bioset",
    actionIds: servicesOnlySelectionActionIds,
    // DWNLD is enabled by default; BIOSETS is dispatched by this collection even
    // though the shared config disables it.
    extraEnabledActionIds: ["biosets"],
    idField: "bioset_id",
    idKind: "genome",
    singularLabel: "Bioset",
    hasSelectableServices: false,
  },
} as const satisfies Partial<
  Record<
    DataResource,
    {
      searchType:
        | "strain"
        | "genome"
        | "genome_feature"
        | "genome_sequence"
        | "protein_feature"
        | "protein_structure"
        | "sequence_feature"
        | "epitope"
        | "serology"
        | "surveillance"
        | "ppi"
        | "experiment"
        | "bioset";
      actionIds: readonly SearchActionId[];
      extraEnabledActionIds: readonly SearchActionId[];
      idField: string | readonly string[];
      idKind: SelectionServiceKind;
      singularLabel: string;
      hasSelectableServices: boolean;
    }
  >
>;

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
  loadedKeywordValue?: string;
  onLoadedKeywordChange?: (value: string) => void;
  keywordPlaceholder?: string;
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
  loadedKeywordValue,
  onLoadedKeywordChange,
  keywordPlaceholder,
  prefetchNextPage = false,
  onExport,
}: ResourceCollectionProps<Row>) {
  const [exportError, setExportError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [taxonomyServiceIds, setTaxonomyServiceIds] = useState<string[]>([]);
  const [isTaxonomyServiceOpen, setIsTaxonomyServiceOpen] = useState(false);
  const [loadingActionIds, setLoadingActionIds] = useState<SearchActionId[]>(
    [],
  );
  const [selectedRowsById, setSelectedRowsById] = useState<
    Partial<Record<string, Row>>
  >({});
  const [internalLoadedKeyword, setInternalLoadedKeyword] = useState("");
  const loadedKeyword = loadedKeywordValue ?? internalLoadedKeyword;
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
    serverKeywordMode: profile.serverKeywordMode,
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
    (
      profile.rowLinkFields ?? [profile.rowLinkField ?? profile.idField]
    ).includes(column.id) &&
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
  const knownSingleStrainHasNoGenomes =
    profile.resource === "strain" &&
    displayedSelectedIds.length === 1 &&
    displayedDetail !== null &&
    genomeIdsFromStrains([displayedDetail]).length === 0;
  const selectedFeatureId = featureIdFromRow(displayedDetail);
  const sequenceId = displayedDetail?.sequence_id;
  const selectedSequenceId =
    profile.resource === "genome_sequence" &&
    (typeof sequenceId === "string" || typeof sequenceId === "number")
      ? String(sequenceId)
      : "";
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

  const selectedActionCount = hasLoadedKeyword
    ? displayedSelectedIds.length
    : collection.isAllPagesSelected
      ? collection.total
      : collection.selectedIds.length;

  const selectionActionsConfig =
    profile.resource in selectionActionsConfigByResource
      ? selectionActionsConfigByResource[
          profile.resource as keyof typeof selectionActionsConfigByResource
        ]
      : undefined;

  /**
   * Reasons a collection's own rows cannot reach an action it otherwise dispatches:
   * structure rows only reach the Genome, Feature and Structure members they carry,
   * and Bioset rows need an experiment behind every selected row.
   */
  const collectionDisabledActions =
    profile.resource === "protein_structure"
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
        : undefined;

  const resolveActionRows = async (
    fields: readonly string[],
    maxRows: number,
    actionLabel: string,
  ): Promise<Record<string, unknown>[]> => {
    if (selectedActionCount > maxRows) {
      throw new Error(
        `${actionLabel} supports at most ${maxRows.toLocaleString()} ${profile.label}. Narrow the selection and try again.`,
      );
    }

    const selectedFields = [...fields];
    if (!collection.isAllPagesSelected || hasLoadedKeyword) {
      const ids = [...displayedSelectedIds];
      const rows: Record<string, unknown>[] = [];
      for (let offset = 0; offset < ids.length; offset += 500) {
        const result = await repository.selected(profile.resource, {
          ids: ids.slice(offset, offset + 500),
          fields: selectedFields,
        });
        rows.push(...result.rows);
      }
      return rows;
    }

    if (collection.isRefreshing) {
      throw new Error(
        "Wait for the current results to finish loading and try again.",
      );
    }
    const result = await repository.exportAll(profile.resource, {
      rql: effectiveRql,
      keyword: requestState.keyword,
      keywordMode: profile.serverKeywordMode,
      fields: selectedFields,
      sort: dataSort(state.sort),
    });
    return result.rows;
  };

  const resolveSelectedTaxonIds = async (): Promise<string[]> => {
    if (!collection.isAllPagesSelected) {
      return normalizeTaxonIds(displayedSelectedIds);
    }
    if (collection.total > maxTaxonomyActionIds) {
      throw new Error(taxonomyActionLimitMessage());
    }
    const result = await repository.exportAll("taxonomy", {
      rql: effectiveRql,
      keyword: requestState.keyword,
      keywordMode: profile.serverKeywordMode,
      fields: ["taxon_id"],
      sort: dataSort(state.sort),
    });
    return normalizeTaxonIds(result.rows.map((row) => row.taxon_id));
  };

  const runTaxonomyAction = async (actionId: SearchActionId) => {
    setActionError(null);
    setLoadingActionIds([actionId]);
    try {
      const ids = await resolveSelectedTaxonIds();
      if (actionId === "taxonOverview" && ids.length === 1) {
        window.open(taxonomyHref(ids[0]), "_blank", "noopener,noreferrer");
      } else if (actionId === "genomes") {
        window.open(taxonomyGenomesHref(ids), "_blank", "noopener,noreferrer");
      } else if (actionId === "features" && ids.length === 1) {
        window.open(taxonomyFeaturesHref(ids), "_blank", "noopener,noreferrer");
      } else if (actionId === "services") {
        setTaxonomyServiceIds(ids);
        setIsTaxonomyServiceOpen(true);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingActionIds([]);
    }
  };

  const openBiosetResults = async () => {
    setActionError(null);
    if (!collection.isAllPagesSelected) {
      window.open(
        biosetResultsHref(selectedBiosetExperimentIds),
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (collection.total > maxExportRows) {
      setActionError(
        `This selection contains ${collection.total.toLocaleString()} Biosets. Narrow the results to ${maxExportRows.toLocaleString()} or fewer and try again.`,
      );
      return;
    }
    const resultsWindow = window.open("about:blank", "_blank");
    if (!resultsWindow) {
      setActionError("Allow pop-ups to open the selected Bioset results.");
      return;
    }
    resultsWindow.opener = null;
    try {
      const result = await repository.exportAll(profile.resource, {
        rql: effectiveRql,
        keyword: requestState.keyword,
        fields: ["exp_id"],
        sort: dataSort(state.sort),
      });
      const experimentIds = result.rows.flatMap((row) => {
        const experimentId = experimentIdFromRow(row);
        return experimentId ? [experimentId] : [];
      });
      if (experimentIds.length !== result.rows.length) {
        resultsWindow.close();
        setActionError(
          experimentIds.length === 0
            ? "No experiments are associated with this selection."
            : "Some selected Biosets are not associated with experiments.",
        );
        return;
      }
      resultsWindow.location.replace(biosetResultsHref(experimentIds));
    } catch (error) {
      resultsWindow.close();
      setActionError(
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
            keywordMode: profile.serverKeywordMode,
            fields: hasLoadedKeyword ? allFields : selectedFields,
            sort: dataSort(state.sort),
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

  /** Dispatch for action-bar entries backed by the current selection. */
  const dispatchAction = (actionId: SearchActionId) => {
    if (
      profile.resource === "taxonomy" &&
      taxonomyActionIds.includes(actionId as (typeof taxonomyActionIds)[number])
    ) {
      void runTaxonomyAction(actionId);
    } else if (actionId === "download") {
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
    } else if (actionId === "feature" && selectedFeatureId) {
      window.open(
        featureHref(selectedFeatureId),
        "_blank",
        "noopener,noreferrer",
      );
    } else if (actionId === "features" && selectedSequenceId) {
      window.open(
        featureListHref({
          rql: `and(eq(sequence_id,${selectedSequenceId}),eq(annotation,PATRIC),eq(feature_type,CDS))`,
        }),
        "_blank",
        "noopener,noreferrer",
      );
    } else if (actionId === "structure" && selectedStructureHref) {
      window.open(selectedStructureHref, "_blank", "noopener,noreferrer");
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
      window.open(selectedMemberHref, "_blank", "noopener,noreferrer");
    }
  };

  const detailContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="bg-background text-foreground min-h-0 flex-1 overflow-y-auto shadow-md">
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
            <p className="text-muted-foreground text-sm">
              Browse {profile.label.toLowerCase()} records.
            </p>
          </div>
          {profile.guideUrl && (
            <a
              className="text-primary text-sm underline underline-offset-2"
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
        keywordPlaceholder={keywordPlaceholder}
        onChange={({ keyword, filters, clearRql }) => {
          if (keywordMode === "loaded") {
            const nextLoadedKeyword = keyword ?? "";
            if (nextLoadedKeyword !== loadedKeyword) {
              collection.setSelection({});
              collection.setIsAllPagesSelected(false);
            }
            setInternalLoadedKeyword(nextLoadedKeyword);
            onLoadedKeywordChange?.(nextLoadedKeyword);
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
      {actionError && (
        <Alert variant="destructive">
          <AlertTitle>Could not complete action</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
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
            selectionActionsConfig ? (
              <CollectionSelectionActions
                searchType={selectionActionsConfig.searchType}
                label={profile.label}
                singularLabel={selectionActionsConfig.singularLabel}
                actionIds={selectionActionsConfig.actionIds}
                extraEnabledActionIds={
                  selectionActionsConfig.extraEnabledActionIds
                }
                idField={selectionActionsConfig.idField}
                idKind={selectionActionsConfig.idKind}
                selectedCount={selectedActionCount}
                guideUrl={profile.guideUrl}
                hasNoAssociatedGenomes={knownSingleStrainHasNoGenomes}
                disabledActions={collectionDisabledActions}
                hasSelectableServices={
                  selectionActionsConfig.hasSelectableServices
                }
                columns={profile.columns}
                columnVisibility={columnVisibility}
                resolveActionRows={resolveActionRows}
                onError={setActionError}
                onOtherAction={dispatchAction}
              />
            ) : (
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
                  enabledActionsByResource[profile.resource] ??
                  (hasBiosetSelection ? ["biosets"] : undefined)
                }
                loadingActionIds={loadingActionIds}
                disabledActions={
                  hasIncompleteBiosetSelection
                    ? {
                        biosets:
                          "Some selected Biosets are not associated with experiments",
                      }
                    : undefined
                }
                onAction={dispatchAction}
              />
            )
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
      {profile.resource === "taxonomy" && (
        <TaxonomyServiceChooser
          open={isTaxonomyServiceOpen}
          onOpenChange={setIsTaxonomyServiceOpen}
          taxonIds={taxonomyServiceIds}
        />
      )}
    </section>
  );
}
