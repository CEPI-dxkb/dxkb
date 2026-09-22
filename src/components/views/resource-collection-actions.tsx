"use client";

import { useRef, useState, type ReactNode } from "react";
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
import { CollectionSelectionActions } from "./collection-selection-actions";
import type { SelectionServiceKind } from "./selection-service-chooser";
import { TaxonomyServiceChooser } from "./taxonomy-service-chooser";

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
    // DWNLD is enabled by default; BIOSETS is dispatched by this component even
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
 * Per-sink fallback for `formatUserFacingErrorMessage`, used for a non-`Error`
 * rejection and for an `Error` whose message is empty or whitespace-only. The shared
 * helper owns the emptiness, non-`Error` and length decisions; only the wording is
 * decided here. It may not be blank: an empty string would be falsy and suppress the
 * collection shell's `{actionError && (...)}` render guard entirely.
 */
const genericActionErrorMessage =
  "The requested action could not be completed. Please try again.";

/** Why BIOSETS cannot run when only some selected Biosets name an experiment. */
const incompleteBiosetSelectionReason =
  "Some selected Biosets are not associated with experiments";

/**
 * The part of `ResourceCollectionProfile` the action bar reads. Declared here rather
 * than imported so the boundary states its own requirements and the dependency runs
 * one way, from the collection shell to its actions.
 */
export interface ResourceCollectionActionsProfile<Row extends DataTableRow> {
  resource: DataResource;
  label: string;
  columns: readonly DataTableColumn[];
  guideUrl?: string;
  rowHref?: (row: Row) => string | undefined;
}

/** What the collection shell knows about the current selection. */
export interface ResourceCollectionActionsSelection<Row extends DataTableRow> {
  /** Count the bar reports: the all-pages total, or the displayed selection size. */
  count: number;
  /**
   * Every explicitly selected ID, including rows a loaded keyword currently hides.
   * Only the Bioset experiment lookup reads this; every other action reaches for
   * `displayedIds`. The two coincide wherever Bioset is actually mounted (no caller
   * gives it `keywordMode="loaded"`), so both are carried rather than collapsed —
   * picking one for everything would be a behaviour change dressed as a cleanup.
   */
  ids: readonly string[];
  /** Selected IDs a loaded keyword leaves visible. */
  displayedIds: readonly string[];
  isAllPagesSelected: boolean;
  /** Rows matching the current query, which bounds the all-pages resolutions. */
  total: number;
  /** The row behind a selected ID, remembered across pages by the shell. */
  rowById: (id: string) => Row | undefined;
}

/**
 * Identifiers and member destinations a resource's own row selection resolves to, so
 * the disabled-reason policy and dispatch read one description of what the current
 * selection can actually reach.
 */
interface ResourceCollectionActionTargets {
  selectedGenomeId: string | null;
  /** The one selected Strain is known to carry no genomes, so its actions are dead. */
  knownSingleStrainHasNoGenomes: boolean;
  selectedFeatureId: string | null;
  selectedSequenceId: string;
  selectedEpitopeId: string | null;
  selectedExperimentId: string | null;
  selectedStructureHref: string | undefined;
  /** The detail row's own canonical route, used by SRVLNCE and SEROLOGY. */
  selectedMemberHref: string | undefined;
  selectedBiosetExperimentIds: string[];
  /** Every selected Bioset has an experiment behind it, so BIOSETS can run. */
  hasBiosetSelection: boolean;
  /** Some but not all selected Biosets have one, so BIOSETS says why it cannot. */
  hasIncompleteBiosetSelection: boolean;
}

/** Pure: every input arrives as an argument, so there is nothing to mock. */
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
    // A Genome collection's rows *are* genomes, so the active row's own ID is the
    // destination; every other resource carries its genome in a column.
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

/**
 * Reasons a collection's own rows cannot reach an action it otherwise dispatches:
 * structure rows only reach the Genome, Feature and Structure members they carry,
 * and Bioset rows need an experiment behind every selected row.
 */
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

export interface ResourceCollectionActionsOptions<Row extends DataTableRow> {
  profile: ResourceCollectionActionsProfile<Row>;
  selection: ResourceCollectionActionsSelection<Row>;
  /** The detail row, or null while a loaded keyword hides it. */
  detail: Row | null;
  /** The detail row's ID, or null while a loaded keyword hides it. */
  activeId: string | null;
  columnVisibility: Record<string, boolean>;
  /** Fetch the selected rows (or every matching row) with the supplied fields. */
  resolveActionRows: (
    fields: readonly string[],
    maxRows: number,
    actionLabel: string,
  ) => Promise<Record<string, unknown>[]>;
  /**
   * Fetch every row matching the current query, for the two all-pages workflows that
   * resolve an ID column the table does not hold. The shell owns the query, so scope,
   * keyword and sort stay in one place.
   */
  resolveAllMatchingRows: (
    fields: readonly string[],
  ) => Promise<Record<string, unknown>[]>;
  /** Run the collection's own export over the current selection (DWNLD). */
  onExportSelection: () => void;
  /** Report an action failure to the collection shell, which renders it. */
  onError: (message: string | null) => void;
}

/**
 * Everything the collection action bar needs to know about a specific resource:
 * which actions each one owns, what its row selection resolves to, why an action is
 * a dead end, and the Taxonomy and Bioset workflows that need a network round-trip
 * before they can navigate.
 *
 * Kept out of `ResourceCollection` so adding a resource touches this file instead of
 * the generic query, export and table code. The shell keeps querying, URL and filter
 * state, loaded-keyword behaviour, table and detail rendering, and export; it passes
 * in the current selection and takes back only an error message.
 *
 * **A hook returning two slots, deliberately, not a component.** The shell renders
 * `ResourceWorkspace` only on the success path: a collection error (including one from
 * a background refetch) replaces the whole workspace, action bar included, with an
 * alert. The Taxonomy launch resolves IDs over the network before it can navigate, so
 * a chooser living inside the bar would vanish mid-flight the moment that happened —
 * no chooser, no error, no spinner. Running here puts `loadingActionIds`, the overlap
 * ref and the chooser's own state in the shell's instance, and hands the chooser back
 * as `actionDialogs` for the shell to render at section level, as a sibling of the
 * workspace rather than a descendant.
 *
 * Crossing the `md` breakpoint is *not* one of the reasons: `ResourceWorkspace` renders
 * one stable subtree at every width, so a resize re-styles the `actionBar` slot instead
 * of re-parenting it. That was not always true, and the guarantees above are what stood
 * in for it; they still earn their keep on the error path.
 */
export function useResourceCollectionActions<Row extends DataTableRow>({
  profile,
  selection,
  detail,
  activeId,
  columnVisibility,
  resolveActionRows,
  resolveAllMatchingRows,
  onExportSelection,
  onError,
}: ResourceCollectionActionsOptions<Row>): {
  /** The workspace's action-bar slot. Safe to remount; holds no state. */
  actionBar: ReactNode;
  /** Dialogs the shell must render as a sibling of `ResourceWorkspace`, not inside it. */
  actionDialogs: ReactNode;
} {
  const [taxonomyServiceIds, setTaxonomyServiceIds] = useState<string[]>([]);
  const [isTaxonomyServiceOpen, setIsTaxonomyServiceOpen] = useState(false);
  /**
   * The Taxonomy action currently resolving IDs. Overlapping runs would let the
   * first one's cleanup clear the second one's spinner, and a later SERVICES
   * resolution would replace the IDs an already-open chooser is working with.
   */
  const pendingTaxonomyActionRef = useRef<SearchActionId | null>(null);
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

  // Reachable only for `profile.resource === "taxonomy"`: `dispatchAction` gates
  // `runTaxonomyAction` on the resource, and `resolveAllMatchingRows` queries
  // `profile.resource`, so that gate is what keeps this pointed at the taxonomy core.
  const resolveSelectedTaxonIds = async (): Promise<string[]> => {
    if (!selection.isAllPagesSelected) {
      return normalizeTaxonIds(selection.displayedIds);
    }
    if (selection.total > maxTaxonomyActionIds) {
      throw new Error(taxonomyActionLimitMessage());
    }
    const rows = await resolveAllMatchingRows(["taxon_id"]);
    return normalizeTaxonIds(rows.map((row) => row.taxon_id));
  };

  const runTaxonomyAction = async (actionId: SearchActionId) => {
    onError(null);
    if (pendingTaxonomyActionRef.current) return;
    if (actionId === "services") {
      // Opens an in-page dialog, so there is no tab to reserve.
      pendingTaxonomyActionRef.current = actionId;
      setLoadingActionIds([actionId]);
      try {
        setTaxonomyServiceIds(await resolveSelectedTaxonIds());
        setIsTaxonomyServiceOpen(true);
      } catch (error) {
        onError(formatUserFacingErrorMessage(error, genericActionErrorMessage));
      }
      pendingTaxonomyActionRef.current = null;
      setLoadingActionIds([]);
      return;
    }
    // Resolving an all-pages selection needs a network round-trip, after which
    // browsers no longer treat window.open as user-initiated and block it. Reserve
    // the tab inside the click and navigate it once the IDs are known.
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
      const href =
        actionId === "taxonOverview" && ids.length === 1
          ? taxonomyHref(ids[0])
          : actionId === "genomes"
            ? taxonomyGenomesHref(ids)
            : actionId === "features" && ids.length === 1
              ? taxonomyFeaturesHref(ids)
              : null;
      if (href) {
        navigateReservedTab(resultsWindow, href);
      } else {
        resultsWindow.close();
      }
    } catch (error) {
      resultsWindow.close();
      onError(formatUserFacingErrorMessage(error, genericActionErrorMessage));
    }
    pendingTaxonomyActionRef.current = null;
    setLoadingActionIds([]);
  };

  const openBiosetResults = async () => {
    onError(null);
    if (!selection.isAllPagesSelected) {
      // Reserved and navigated exactly like the other two paths (see
      // `navigateReservedTab`), even though this one awaits nothing first.
      //
      // It cannot be `window.open(href, "_blank", "noopener,noreferrer")` with a null
      // check bolted on: the spec makes `window.open` return null whenever `noopener`
      // is set (and `noreferrer` implies it), so that handle says nothing about
      // whether the pop-up was allowed. That is how this branch came to swallow a
      // blocked pop-up. Opening the final href with no feature string would restore
      // the check but give up `noreferrer`; reserving keeps both.
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
    if (selection.total > maxExportRows) {
      onError(
        `This selection contains ${selection.total.toLocaleString()} Biosets. Narrow the results to ${maxExportRows.toLocaleString()} or fewer and try again.`,
      );
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
      const rows = await resolveAllMatchingRows(["exp_id"]);
      const experimentIds = rows.flatMap((row) => {
        const experimentId = experimentIdFromRow(row);
        return experimentId ? [experimentId] : [];
      });
      if (experimentIds.length === rows.length) {
        navigateReservedTab(resultsWindow, biosetResultsHref(experimentIds));
      } else {
        resultsWindow.close();
        onError(
          experimentIds.length === 0
            ? "No experiments are associated with this selection."
            : "Some selected Biosets are not associated with experiments.",
        );
      }
    } catch (error) {
      resultsWindow.close();
      // Through the shared formatter, not `error.message`: an `Error("")` here used
      // to hand the shell a falsy string, which its `{actionError && (...)}` guard
      // renders as nothing at all — a closed tab and no explanation.
      onError(
        formatUserFacingErrorMessage(
          error,
          "The selected Bioset results could not be loaded.",
        ),
      );
    }
    pendingBiosetActionRef.current = false;
    setLoadingActionIds([]);
  };

  /** Dispatch for action-bar entries backed by the current selection. */
  const dispatchAction = (actionId: SearchActionId) => {
    if (
      profile.resource === "taxonomy" &&
      taxonomyActionIds.includes(actionId as (typeof taxonomyActionIds)[number])
    ) {
      void runTaxonomyAction(actionId);
    } else if (actionId === "download") {
      onExportSelection();
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

  return {
    actionBar: selectionActionsConfig ? (
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
      // Reached only for a resource with no `selectionActionsConfigByResource`
      // entry, which today means Taxonomy alone. `bioset` has an entry, so this
      // branch can never see one — which is why it carries no Bioset fallback for
      // `enabledActions` and no Bioset `disabledActions`: both `hasBiosetSelection`
      // and `hasIncompleteBiosetSelection` require `profile.resource === "bioset"`
      // and are therefore always false here. `CollectionSelectionActions` owns the
      // Bioset bar, and `resolveDisabledActions` above owns its disabled reason.
      <SearchActionBar
        selectedCount={selection.count}
        searchType={profile.resource}
        guideUrl={profile.guideUrl}
        enabledActions={enabledActionsByResource[profile.resource]}
        loadingActionIds={loadingActionIds}
        onError={onError}
        onAction={dispatchAction}
      />
    ),
    actionDialogs:
      profile.resource === "taxonomy" ? (
        <TaxonomyServiceChooser
          open={isTaxonomyServiceOpen}
          onOpenChange={setIsTaxonomyServiceOpen}
          taxonIds={taxonomyServiceIds}
        />
      ) : null,
  };
}
