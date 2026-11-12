"use client";

import { useRef, useState, type ReactNode } from "react";
import { CancelledError } from "@tanstack/react-query";
import {
  SearchActionBar,
  type SearchActionId,
} from "@/components/search/search-action-bar";
import type {
  DataTableColumn,
  DataTableRow,
} from "@/components/shared/data-table";
import {
  maxExportRows,
  serializeRql,
  type DataResource,
} from "@/lib/data-api";
import type {
  DownloadScope,
  ResolvedCollectionDownloadSpec,
} from "@/lib/data-api/downloads";
import type { DataSort } from "@/lib/data-api/types";
import { useCollectionDownload } from "@/hooks/views/use-collection-download";
import { navigateReservedTab } from "@/lib/reserved-tab-navigation";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { genomeIdsFromStrains } from "@/lib/strain-view";
import {
  maxTaxonomyActionIds,
  normalizeTaxonIds,
  taxonomyActionLimitMessage,
  taxonomyFeaturesHref,
  taxonomyGenomesHref,
} from "@/lib/taxonomy-view";
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
  copyAndServicesSelectionActionIds,
  featureSelectionActionIds,
  genomeSelectionActionIds,
  interactionSelectionActionIds,
  sequenceSelectionActionIds,
  servicesOnlySelectionActionIds,
  strainSelectionActionIds,
} from "./collection-selection-action-ids";
import { CollectionDownloadAction } from "./collection-download/collection-download-action";
import { CollectionSelectionActions } from "./collection-selection-actions";
import type { SelectionServiceKind } from "./selection-service-chooser";
import { TaxonomyServiceChooser } from "./taxonomy-service-chooser";
import {
  exceedsReadLimit,
  type MatchingRowsRead,
} from "./use-resource-collection-row-resolution";

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
};

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
    extraEnabledActionIds: [],
    idField: "feature_id",
    idKind: "feature",
    singularLabel: "Feature",
    hasSelectableServices: true,
  },
  genome_sequence: {
    searchType: "genome_sequence",
    actionIds: sequenceSelectionActionIds,
    extraEnabledActionIds: ["features"],
    idField: "genome_id",
    idKind: "genome",
    singularLabel: "Sequence",
    hasSelectableServices: true,
  },
  genome_amr: {
    searchType: "genome_amr",
    // Legacy AMRPanelGridContainer's GROUP adds the rows' genomes to a Genome Group.
    actionIds: genomeSelectionActionIds,
    extraEnabledActionIds: [],
    idField: "genome_id",
    idKind: "genome",
    singularLabel: "AMR Phenotype",
    hasSelectableServices: false,
  },
  protein_feature: {
    searchType: "protein_feature",
    actionIds: copyAndServicesSelectionActionIds,
    extraEnabledActionIds: [],
    idField: "genome_id",
    idKind: "genome",
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
    extraEnabledActionIds: [],
    idField: "id",
    idKind: "genome",
    singularLabel: "Sequence Feature",
    hasSelectableServices: false,
  },
  epitope: {
    searchType: "epitope",
    actionIds: copyAndServicesSelectionActionIds,
    extraEnabledActionIds: [],
    idField: "epitope_id",
    idKind: "genome",
    singularLabel: "Epitope",
    hasSelectableServices: false,
  },
  serology: {
    searchType: "serology",
    actionIds: copyAndServicesSelectionActionIds,
    extraEnabledActionIds: [],
    idField: "id",
    idKind: "genome",
    singularLabel: "Serology",
    hasSelectableServices: false,
  },
  surveillance: {
    searchType: "surveillance",
    actionIds: copyAndServicesSelectionActionIds,
    extraEnabledActionIds: [],
    idField: "id",
    idKind: "genome",
    singularLabel: "Surveillance",
    hasSelectableServices: false,
  },
  ppi: {
    searchType: "ppi",
    actionIds: interactionSelectionActionIds,
    extraEnabledActionIds: [],
    idField: ["feature_id_a", "feature_id_b"],
    idKind: "feature",
    singularLabel: "Interaction",
    hasSelectableServices: false,
  },
  experiment: {
    searchType: "experiment",
    actionIds: servicesOnlySelectionActionIds,
    extraEnabledActionIds: [],
    idField: "exp_id",
    idKind: "genome",
    singularLabel: "Experiment",
    hasSelectableServices: false,
  },
  bioset: {
    searchType: "bioset",
    actionIds: servicesOnlySelectionActionIds,
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
        | "genome_amr"
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

function taxonomyResultsHref(
  actionId: SearchActionId,
  ids: readonly string[],
): string | null {
  if (actionId === "taxonOverview" && ids.length === 1) {
    return taxonomyHref(ids[0]);
  }
  if (actionId === "genomes") return taxonomyGenomesHref(ids);
  if (actionId === "features" && ids.length === 1) {
    return taxonomyFeaturesHref(ids);
  }
  return null;
}

function biosetExperimentIds(rows: readonly DataTableRow[]): string[] {
  return rows.flatMap((row) => {
    const experimentId = experimentIdFromRow(row);
    return experimentId ? [experimentId] : [];
  });
}

function missingExperimentsMessage(experimentCount: number): string {
  return experimentCount === 0
    ? "No experiments are associated with this selection."
    : "Some selected Biosets are not associated with experiments.";
}

async function readBiosetExperimentIds({
  matchingTotal,
  resolveAllMatchingRows,
  limitMessage,
}: {
  matchingTotal: () => Promise<number>;
  resolveAllMatchingRows: (
    fields: readonly string[],
  ) => Promise<MatchingRowsRead>;
  limitMessage: (count: number) => string;
}) {
  const total = await matchingTotal();
  if (total > maxExportRows) throw new Error(limitMessage(total));
  const read = await resolveAllMatchingRows(["exp_id"]);
  if (exceedsReadLimit(read, maxExportRows)) {
    throw new Error(limitMessage(read.total));
  }
  return {
    experimentIds: biosetExperimentIds(read.rows),
    rowCount: read.rows.length,
  };
}

function openMemberTab(
  href: string,
  label: string,
  onError: (message: string) => void,
) {
  const resultsWindow = window.open(href, "_blank");
  if (!resultsWindow) {
    onError(`Allow pop-ups to open the selected ${label}.`);
    return;
  }
  resultsWindow.opener = null;
}

/**
 * Fallback wording for `formatUserFacingErrorMessage`; it may not be blank,
 * since an empty string is falsy and suppresses the shell's `{actionError &&
 * (...)}` guard.
 */
const genericActionErrorMessage =
  "The requested action could not be completed. Please try again.";

const incompleteBiosetSelectionReason =
  "Some selected Biosets are not associated with experiments";

export interface ResourceCollectionActionsProfile<Row extends DataTableRow> {
  resource: DataResource;
  label: string;
  columns: readonly DataTableColumn[];
  guideUrl?: string;
  rowHref?: (row: Row) => string | undefined;
}

export interface ResourceCollectionActionsSelection<Row extends DataTableRow> {
  count: number;
  /**
   * Only the Bioset experiment lookup reads this; every other action uses
   * `displayedIds`.
   */
  ids: readonly string[];
  displayedIds: readonly string[];
  isAllPagesSelected: boolean;
  total: number;
  isPlaceholderData: boolean;
  currentTotal: () => Promise<number>;
  rowById: (id: string) => Row | undefined;
}

interface ResourceCollectionActionTargets {
  selectedGenomeId: string | null;
  knownSingleStrainHasNoGenomes: boolean;
  selectedFeatureId: string | null;
  selectedSequenceId: string;
  selectedEpitopeId: string | null;
  selectedExperimentId: string | null;
  selectedStructureHref: string | undefined;
  selectedMemberHref: string | undefined;
  selectedBiosetExperimentIds: string[];
  hasBiosetSelection: boolean;
  hasIncompleteBiosetSelection: boolean;
}

function resolveActionTargets<Row extends DataTableRow>({
  profile,
  selection,
  detail,
  activeId,
}: {
  profile: ResourceCollectionActionsProfile<Row>;
  selection: ResourceCollectionActionsSelection<Row>;
  detail: Row | null;
  activeId: string | null;
}): ResourceCollectionActionTargets {
  const sequenceId = detail?.sequence_id;
  const selectedPdbId = detail?.pdb_id;
  const selectedBiosetExperimentIds = selection.ids.flatMap((id) => {
    const experimentId = experimentIdFromRow(selection.rowById(id) ?? null);
    return experimentId ? [experimentId] : [];
  });
  const hasCompleteBiosetSelection =
    selectedBiosetExperimentIds.length > 0 &&
    selectedBiosetExperimentIds.length === selection.ids.length;

  return {
    selectedGenomeId:
      profile.resource === "genome" ? activeId : genomeIdFromRow(detail),
    knownSingleStrainHasNoGenomes:
      profile.resource === "strain" &&
      selection.displayedIds.length === 1 &&
      detail !== null &&
      genomeIdsFromStrains([detail]).length === 0,
    selectedFeatureId: featureIdFromRow(detail),
    selectedSequenceId:
      profile.resource === "genome_sequence" &&
      (typeof sequenceId === "string" || typeof sequenceId === "number")
        ? String(sequenceId)
        : "",
    selectedEpitopeId: epitopeIdFromRow(detail),
    selectedExperimentId: experimentIdFromRow(detail),
    selectedStructureHref:
      profile.resource === "protein_structure" &&
      (typeof selectedPdbId === "string" || typeof selectedPdbId === "number")
        ? proteinStructureHref(selectedPdbId)
        : undefined,
    selectedMemberHref: detail ? profile.rowHref?.(detail) : undefined,
    selectedBiosetExperimentIds,
    hasBiosetSelection:
      profile.resource === "bioset" &&
      (selection.isAllPagesSelected || hasCompleteBiosetSelection),
    hasIncompleteBiosetSelection:
      profile.resource === "bioset" &&
      !selection.isAllPagesSelected &&
      selection.ids.length > 0 &&
      !hasCompleteBiosetSelection,
  };
}

function resolveDisabledActions(
  resource: DataResource,
  targets: ResourceCollectionActionTargets,
): Partial<Record<SearchActionId, string>> | undefined {
  if (resource === "protein_structure") {
    return {
      genome: targets.selectedGenomeId
        ? undefined
        : "No genome is associated with this structure",
      feature: targets.selectedFeatureId
        ? undefined
        : "No feature is associated with this structure",
      structure: targets.selectedStructureHref
        ? undefined
        : "A structure accession is required",
    };
  }
  if (targets.hasIncompleteBiosetSelection) {
    return { biosets: incompleteBiosetSelectionReason };
  }
  return undefined;
}

export interface ResourceCollectionDownloadOptions {
  spec: ResolvedCollectionDownloadSpec;
  allResults: { scope: DownloadScope; total: number };
  sort?: DataSort;
  visibleColumnIds: readonly string[];
  fileNameBase: string;
  queryLabel?: string;
}

export interface ResourceCollectionActionsOptions<Row extends DataTableRow> {
  profile: ResourceCollectionActionsProfile<Row>;
  selection: ResourceCollectionActionsSelection<Row>;
  detail: Row | null;
  activeId: string | null;
  columnVisibility: Record<string, boolean>;
  resolveActionRows: (
    fields: readonly string[],
    maxRows: number,
    actionLabel: string,
  ) => Promise<Record<string, unknown>[]>;
  resolveAllMatchingRows: (
    fields: readonly string[],
  ) => Promise<MatchingRowsRead>;
  download?: ResourceCollectionDownloadOptions;
  onError: (message: string | null) => void;
}

/**
 * A hook returning two slots, not a component: a collection error drops the
 * action bar, so the Taxonomy chooser (which resolves IDs over the network)
 * must live in the shell's instance and render as `actionDialogs` beside the
 * workspace.
 */
export function useResourceCollectionActions<Row extends DataTableRow>({
  profile,
  selection,
  detail,
  activeId,
  columnVisibility,
  resolveActionRows,
  resolveAllMatchingRows,
  download,
  onError,
}: ResourceCollectionActionsOptions<Row>): {
  actionBar: ReactNode;
  actionDialogs: ReactNode;
} {
  const [taxonomyServiceIds, setTaxonomyServiceIds] = useState<string[]>([]);
  const [isTaxonomyServiceOpen, setIsTaxonomyServiceOpen] = useState(false);
  const pendingTaxonomyActionRef = useRef<SearchActionId | null>(null);
  /** SERVICES, which takes focus back when the Taxonomy chooser closes. */
  const taxonomyServicesButtonRef = useRef<HTMLButtonElement>(null);
  const pendingBiosetActionRef = useRef(false);
  const [loadingActionIds, setLoadingActionIds] = useState<SearchActionId[]>(
    [],
  );

  const targets = resolveActionTargets({
    profile,
    selection,
    detail,
    activeId,
  });
  const selectionActionsConfig =
    profile.resource in selectionActionsConfigByResource
      ? selectionActionsConfigByResource[
          profile.resource as keyof typeof selectionActionsConfigByResource
        ]
      : undefined;

  const matchingTotal = async () =>
    selection.isPlaceholderData ? selection.currentTotal() : selection.total;

  const resolveSelectedTaxonIds = async (): Promise<string[]> => {
    if (!selection.isAllPagesSelected) {
      return normalizeTaxonIds(selection.displayedIds);
    }
    if ((await matchingTotal()) > maxTaxonomyActionIds) {
      throw new Error(taxonomyActionLimitMessage());
    }
    const { rows } = await resolveAllMatchingRows(["taxon_id"]);
    return normalizeTaxonIds(rows.map((row) => row.taxon_id));
  };

  const runTaxonomyAction = async (actionId: SearchActionId) => {
    onError(null);
    if (pendingTaxonomyActionRef.current) return;
    if (actionId === "services") {
      pendingTaxonomyActionRef.current = actionId;
      setLoadingActionIds([actionId]);
      try {
        setTaxonomyServiceIds(await resolveSelectedTaxonIds());
        setIsTaxonomyServiceOpen(true);
      } catch (error) {
        if (!(error instanceof CancelledError)) {
          onError(
            formatUserFacingErrorMessage(error, genericActionErrorMessage),
          );
        }
      }
      pendingTaxonomyActionRef.current = null;
      setLoadingActionIds([]);
      return;
    }
    // Reserve the tab inside the click: after a network round-trip browsers no
    // longer treat `window.open` as user-initiated.
    const resultsWindow = window.open("about:blank", "_blank");
    if (!resultsWindow) {
      onError(`Allow pop-ups to open the selected ${profile.label}.`);
      return;
    }
    resultsWindow.opener = null;
    pendingTaxonomyActionRef.current = actionId;
    setLoadingActionIds([actionId]);
    try {
      const ids = await resolveSelectedTaxonIds();
      const href = taxonomyResultsHref(actionId, ids);
      if (href) {
        navigateReservedTab(resultsWindow, href);
      } else {
        resultsWindow.close();
      }
    } catch (error) {
      resultsWindow.close();
      if (!(error instanceof CancelledError)) {
        onError(formatUserFacingErrorMessage(error, genericActionErrorMessage));
      }
    }
    pendingTaxonomyActionRef.current = null;
    setLoadingActionIds([]);
  };

  const openBiosetResults = async () => {
    onError(null);
    if (!selection.isAllPagesSelected) {
      // Reserved like the other paths: `noopener` makes `window.open` return
      // null, so a null check cannot tell a blocked pop-up from an allowed one.
      const resultsWindow = window.open("about:blank", "_blank");
      if (!resultsWindow) {
        onError("Allow pop-ups to open the selected Bioset results.");
        return;
      }
      resultsWindow.opener = null;
      navigateReservedTab(
        resultsWindow,
        biosetResultsHref(targets.selectedBiosetExperimentIds),
      );
      return;
    }
    if (pendingBiosetActionRef.current) return;
    const limitMessage = (count: number) =>
      `This selection contains ${count.toLocaleString()} Biosets. Narrow the results to ${maxExportRows.toLocaleString()} or fewer and try again.`;
    if (!selection.isPlaceholderData && selection.total > maxExportRows) {
      onError(limitMessage(selection.total));
      return;
    }
    const resultsWindow = window.open("about:blank", "_blank");
    if (!resultsWindow) {
      onError("Allow pop-ups to open the selected Bioset results.");
      return;
    }
    resultsWindow.opener = null;
    pendingBiosetActionRef.current = true;
    setLoadingActionIds(["biosets"]);
    try {
      const { experimentIds, rowCount } = await readBiosetExperimentIds({
        matchingTotal,
        resolveAllMatchingRows,
        limitMessage,
      });
      if (experimentIds.length === rowCount) {
        navigateReservedTab(resultsWindow, biosetResultsHref(experimentIds));
      } else {
        resultsWindow.close();
        onError(missingExperimentsMessage(experimentIds.length));
      }
    } catch (error) {
      resultsWindow.close();
      // Through the shared formatter: an `Error("")` message is falsy and the
      // shell's guard would render nothing.
      if (!(error instanceof CancelledError)) {
        onError(
          formatUserFacingErrorMessage(
            error,
            "The selected Bioset results could not be loaded.",
          ),
        );
      }
    }
    pendingBiosetActionRef.current = false;
    setLoadingActionIds([]);
  };

  const dispatchAction = (actionId: SearchActionId) => {
    if (
      profile.resource === "taxonomy" &&
      taxonomyActionIds.includes(actionId as (typeof taxonomyActionIds)[number])
    ) {
      void runTaxonomyAction(actionId);
    } else if (actionId === "biosets" && targets.hasBiosetSelection) {
      void openBiosetResults();
    } else if (actionId === "genome" && targets.selectedGenomeId) {
      openMemberTab(genomeHref(targets.selectedGenomeId), "Genome", onError);
    } else if (actionId === "feature" && targets.selectedFeatureId) {
      openMemberTab(featureHref(targets.selectedFeatureId), "Feature", onError);
    } else if (actionId === "features" && targets.selectedSequenceId) {
      openMemberTab(
        featureListHref({
          rql: serializeRql("genome_feature", {
            operator: "and",
            operands: [
              {
                operator: "eq",
                field: "sequence_id",
                value: targets.selectedSequenceId,
              },
              { operator: "eq", field: "annotation", value: "PATRIC" },
              { operator: "eq", field: "feature_type", value: "CDS" },
            ],
          }),
        }),
        "Features",
        onError,
      );
    } else if (actionId === "structure" && targets.selectedStructureHref) {
      openMemberTab(targets.selectedStructureHref, "Protein Structure", onError);
    } else if (actionId === "epitope" && targets.selectedEpitopeId) {
      openMemberTab(epitopeHref(targets.selectedEpitopeId), "Epitope", onError);
    } else if (actionId === "experiment" && targets.selectedExperimentId) {
      openMemberTab(
        experimentHref(targets.selectedExperimentId),
        "Experiment",
        onError,
      );
    } else if (
      (actionId === "surveillance" || actionId === "serology") &&
      targets.selectedMemberHref
    ) {
      openMemberTab(
        targets.selectedMemberHref,
        actionId === "surveillance" ? "Surveillance record" : "Serology record",
        onError,
      );
    }
  };

  const collectionDownload = useCollectionDownload();
  const withDownloadTile = (actions: ReactNode) =>
    download?.spec.enabled ? (
      <div className="flex flex-col gap-1 max-md:flex-row">
        <CollectionDownloadAction
          label={profile.label}
          spec={download.spec}
          selection={{
            count: selection.count,
            ids: selection.displayedIds,
            isAllPagesSelected: selection.isAllPagesSelected,
          }}
          allResults={download.allResults}
          sort={download.sort}
          isPlaceholderData={selection.isPlaceholderData}
          visibleColumnIds={download.visibleColumnIds}
          fileNameBase={download.fileNameBase}
          queryLabel={download.queryLabel}
          pending={collectionDownload.pending}
          onDownload={(request, options) => {
            collectionDownload.download(profile.resource, request, options);
          }}
        />
        {actions}
      </div>
    ) : (
      actions
    );

  const bar = selectionActionsConfig ? (
    <CollectionSelectionActions
      searchType={selectionActionsConfig.searchType}
      label={profile.label}
      singularLabel={selectionActionsConfig.singularLabel}
      actionIds={selectionActionsConfig.actionIds}
      extraEnabledActionIds={selectionActionsConfig.extraEnabledActionIds}
      idField={selectionActionsConfig.idField}
      idKind={selectionActionsConfig.idKind}
      selectedCount={selection.count}
      guideUrl={profile.guideUrl}
      hasNoAssociatedGenomes={targets.knownSingleStrainHasNoGenomes}
      disabledActions={resolveDisabledActions(profile.resource, targets)}
      externalLoadingActionIds={loadingActionIds}
      hasSelectableServices={selectionActionsConfig.hasSelectableServices}
      columns={profile.columns}
      columnVisibility={columnVisibility}
      resolveActionRows={resolveActionRows}
      onError={onError}
      onOtherAction={dispatchAction}
    />
  ) : (
    // Reached only for resources with no `selectionActionsConfigByResource`
    // entry (Taxonomy), so no Bioset fallbacks are needed.
    <SearchActionBar
      selectedCount={selection.count}
      searchType={profile.resource}
      guideUrl={profile.guideUrl}
      enabledActions={enabledActionsByResource[profile.resource]}
      loadingActionIds={loadingActionIds}
      actionRefs={{ services: taxonomyServicesButtonRef }}
      onError={onError}
      onAction={dispatchAction}
    />
  );

  return {
    actionBar: withDownloadTile(bar),
    actionDialogs:
      profile.resource === "taxonomy" ? (
        <TaxonomyServiceChooser
          open={isTaxonomyServiceOpen}
          onOpenChange={setIsTaxonomyServiceOpen}
          taxonIds={taxonomyServiceIds}
          finalFocus={taxonomyServicesButtonRef}
        />
      ) : null,
  };
}
