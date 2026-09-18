"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  SearchActionBar,
  type SearchActionId,
} from "@/components/search/search-action-bar";
import { SelectionToGroupDialog } from "@/components/workspace/selection-to-group-dialog";
import type { DataTableColumn } from "@/components/shared/data-table";
import { useAuth } from "@/lib/auth/provider";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { invalidateWorkspace } from "@/lib/services/workspace/workspace-query-keys";
import { workspaceUsername } from "@/lib/services/workspace/path-utils";
import { featuresHrefFromIds, genomesHrefFromIds } from "@/lib/views/hrefs";
import {
  idsFromRows,
  selectionCopyMaxRows,
  selectionFeaturesMaxRows,
  selectionGenomesMaxRows,
  selectionGroupMaxIds,
  selectionGroupMaxRows,
  selectionListMaxIds,
  selectionListMaxUrlLength,
  selectionServicesMaxIds,
  selectionServicesMaxRows,
} from "@/lib/views/collection-selection";
import { serializeResourceRows } from "./resource-export";
import {
  CollectionCopyDialog,
  type CopyColumnMode,
} from "./collection-copy-dialog";
import {
  SelectionServiceChooser,
  type SelectionServiceKind,
} from "./selection-service-chooser";

/** Actions the Strain collection owns. Visibility and dispatch read the same list. */
export const strainSelectionActionIds = [
  "copyRows",
  "services",
  "genomes",
  "group",
] as const satisfies readonly SearchActionId[];

/**
 * Actions the Genome collection owns. `genomes` is absent because the rows already
 * are the genome list, and `genome` stays with ResourceCollection's member dispatch.
 */
export const genomeSelectionActionIds = [
  "copyRows",
  "services",
  "group",
] as const satisfies readonly SearchActionId[];

/**
 * Actions the Sequence collection owns. `download`, `genome` and `features` stay with
 * ResourceCollection's export and member dispatch, and FASTA and Browser keep their
 * "not ready" tooltip until a later PR wires them.
 */
export const sequenceSelectionActionIds = [
  "copyRows",
  "services",
  "group",
] as const satisfies readonly SearchActionId[];

/**
 * Actions the Feature collection owns. `download`, `feature` and `genome` stay with
 * ResourceCollection's export and member dispatch, and FASTA and ID MAP keep their
 * "not ready" tooltip until a later PR wires them.
 */
export const featureSelectionActionIds = [
  "copyRows",
  "services",
  "group",
] as const satisfies readonly SearchActionId[];

/**
 * Actions the Protein Structure, Domains and Motifs, SFVT, Epitope, Serology and
 * Surveillance collections own. Their SERVICES button opens the chooser with no
 * selectable services (legacy runs nothing from these tabs); `download`, `genome`,
 * `feature`, `structure`, `epitope`, `serology` and `surveillance` stay with
 * ResourceCollection's export and member dispatch.
 */
export const copyAndServicesSelectionActionIds = [
  "copyRows",
  "services",
] as const satisfies readonly SearchActionId[];

/**
 * Actions the Interaction collection owns. FEATURES pools both interactors of every
 * selected row, which is also what GROUP writes to its Feature Group; `download` stays
 * with ResourceCollection's export and FASTA keeps its "not ready" tooltip until a
 * later PR wires it.
 */
export const interactionSelectionActionIds = [
  "copyRows",
  "services",
  "ppiFeatures",
  "group",
] as const satisfies readonly SearchActionId[];

/**
 * Actions the Experiment and Bioset collections own. Legacy leaves COPY ROWS out of
 * both containers' `validContainerTypes` and runs no service from them, so SERVICES is
 * all that is left; `download`, `experiment` and `biosets` stay with
 * ResourceCollection's export and member dispatch.
 */
export const servicesOnlySelectionActionIds = [
  "services",
] as const satisfies readonly SearchActionId[];

/**
 * Workspace group each ID kind writes to. `title` also names the default folder
 * (`Genome Groups` / `Feature Groups`), matching legacy.
 */
const groupTargetByKind = {
  genome: {
    title: "Genome Group",
    createInput: { type: "genome_group", idField: "genome_id" },
  },
  feature: {
    title: "Feature Group",
    createInput: { type: "feature_group", idField: "feature_id" },
  },
} as const satisfies Record<
  SelectionServiceKind,
  {
    title: string;
    createInput:
      | { type: "genome_group"; idField: "genome_id" }
      | { type: "feature_group"; idField: "feature_id" };
  }
>;

interface CollectionSelectionActionsProps {
  /** Drives which SearchActionBar entries are in scope for this resource. */
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
  /** Plural collection label, e.g. "Strains" or "Genomes". */
  label: string;
  /** Singular of `label` for one-row messages. Defaults to `label` without its "s". */
  singularLabel?: string;
  /** The subset of actions this component dispatches itself. */
  actionIds: readonly SearchActionId[];
  /**
   * Actions the owning collection dispatches through `onOtherAction` that the shared
   * config disables by default, so the bar still has to render them enabled.
   */
  extraEnabledActionIds?: readonly SearchActionId[];
  /**
   * Row field(s) the selection's service, list and group IDs come from. Several fields
   * are pooled and de-duplicated together (Interactions carry two interactors a row).
   */
  idField: string | readonly string[];
  /** What `idField` holds. Drives the service set and the group type. */
  idKind?: SelectionServiceKind;
  selectedCount: number;
  guideUrl?: string;
  /** The one selected row is known to have no genomes, so every action is a dead end. */
  hasNoAssociatedGenomes?: boolean;
  /** Reasons the owning collection disables bar entries it dispatches itself. */
  disabledActions?: Partial<Record<SearchActionId, string>>;
  /** False when no service accepts this collection's selection; SERVICES says so. */
  hasSelectableServices?: boolean;
  columns: readonly DataTableColumn[];
  columnVisibility: Record<string, boolean>;
  /** Fetch the selected rows (or every matching row) with the supplied fields. */
  resolveActionRows: (
    fields: readonly string[],
    maxRows: number,
    actionLabel: string,
  ) => Promise<Record<string, unknown>[]>;
  onError: (message: string | null) => void;
  /** Dispatch for bar entries this component does not own (e.g. GENOME). */
  onOtherAction?: (actionId: SearchActionId) => void;
}

/**
 * The action bar and dialogs shared by every collection whose row selection resolves
 * to a set of IDs a service or workspace group accepts — Genome IDs (Strains via
 * `genome_ids`, Genomes, Sequences and Protein Structures via `genome_id`) or Feature
 * IDs (Features via `feature_id`, Interactions via both interactor columns). Kept out
 * of ResourceCollection so the auth,
 * workspace-repository and query-client hooks this behaviour needs mount only on the
 * resources that use them.
 */
export function CollectionSelectionActions({
  searchType,
  label,
  singularLabel: singularLabelProp,
  actionIds,
  extraEnabledActionIds,
  idField,
  idKind = "genome",
  selectedCount,
  guideUrl,
  hasNoAssociatedGenomes = false,
  disabledActions,
  hasSelectableServices = true,
  columns,
  columnVisibility,
  resolveActionRows,
  onError,
  onOtherAction,
}: CollectionSelectionActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const workspaceRepository = useWorkspaceRepository("authenticated");
  const [selectionIds, setSelectionIds] = useState<string[]>([]);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [loadingActionIds, setLoadingActionIds] = useState<SearchActionId[]>(
    [],
  );
  /** The action currently resolving IDs, so overlapping resolutions are rejected. */
  const pendingActionRef = useRef<SearchActionId | null>(null);
  // "Strains" -> "Strain". Only used for the copied-rows toast and the no-genomes
  // reason, so labels that do not pluralize by suffix pass their own singular.
  const singularLabel = singularLabelProp ?? label.replace(/s$/, "");
  const groupCopy = groupTargetByKind[idKind];

  /**
   * Fetch the selection's rows and flatten them to IDs. Both ceilings matter and they
   * are different numbers: `maxRows` bounds the fetch (enforced inside
   * `resolveActionRows`, before anything is requested), while `maxIds` bounds what
   * actually leaves the page — `idsFromRows` flattens a Strain's `genome_ids` and pools
   * both Interaction interactors, so one row can contribute many IDs.
   */
  const resolveSelectionIds = async ({
    maxRows,
    maxIds,
    actionLabel,
    advice,
  }: {
    maxRows: number;
    maxIds: number;
    actionLabel: string;
    /** What the user should do instead; closes the over-ceiling message. */
    advice: string;
  }) => {
    const fields = typeof idField === "string" ? [idField] : idField;
    const rows = await resolveActionRows(fields, maxRows, actionLabel);
    const ids = idsFromRows(rows, idField);
    if (ids.length === 0) {
      throw new Error(`No ${idKind}s are associated with this selection.`);
    }
    if (ids.length > maxIds) {
      throw new Error(
        `This selection resolves to ${ids.length.toLocaleString()} ${idKind} IDs; ${actionLabel} supports at most ${maxIds.toLocaleString()}. ${advice}`,
      );
    }
    return ids;
  };

  const runAction = async (actionId: SearchActionId) => {
    if (!actionIds.includes(actionId)) {
      onOtherAction?.(actionId);
      return;
    }
    onError(null);
    if (actionId === "copyRows") {
      setIsCopyOpen(true);
      return;
    }
    // Nothing to prefill, so skip resolving the selection's IDs and just report it.
    if (actionId === "services" && !hasSelectableServices) {
      setIsServiceOpen(true);
      return;
    }
    // `selectionIds` is one shared slot, so a second resolution would overwrite the
    // IDs an already-open dialog is working with. A ref rejects the overlap in the
    // same tick, which disabled state alone cannot do.
    if (pendingActionRef.current) return;
    pendingActionRef.current = actionId;
    setLoadingActionIds([actionId]);
    try {
      // Both list actions pre-check the ID count rather than leaning on the href
      // builders returning null: the explicit check can name the resolved ID count and
      // the destination, and it keeps all four owned actions on one enforcement path.
      // The `!href` arm below stays for type narrowing (and as a backstop if the
      // builders' rules diverge); the URL-length arm is a genuinely separate bound
      // that long feature IDs reach well before 500 of them.
      if (actionId === "genomes") {
        const href = genomesHrefFromIds(
          await resolveSelectionIds({
            maxRows: selectionGenomesMaxRows,
            maxIds: selectionListMaxIds,
            actionLabel: "Genomes",
            advice: "Narrow the selection or create a Genome Group.",
          }),
        );
        if (!href || href.length > selectionListMaxUrlLength) {
          throw new Error(
            "This selection contains too many genome IDs to open safely. Narrow the selection or create a Genome Group.",
          );
        }
        router.push(href);
      } else if (actionId === "ppiFeatures") {
        const href = featuresHrefFromIds(
          await resolveSelectionIds({
            maxRows: selectionFeaturesMaxRows,
            maxIds: selectionListMaxIds,
            actionLabel: "Features",
            advice: "Narrow the selection or create a Feature Group.",
          }),
        );
        if (!href || href.length > selectionListMaxUrlLength) {
          throw new Error(
            "This selection contains too many feature IDs to open safely. Narrow the selection or create a Feature Group.",
          );
        }
        router.push(href);
      } else if (actionId === "services") {
        setSelectionIds(
          await resolveSelectionIds({
            maxRows: selectionServicesMaxRows,
            maxIds: selectionServicesMaxIds,
            actionLabel: "Services",
            // A group is what SERVICES already builds, so suggesting one would be
            // circular — the only way out is a smaller selection.
            advice: "Narrow the selection and try again.",
          }),
        );
        setIsServiceOpen(true);
      } else if (actionId === "group" && isAuthenticated) {
        setSelectionIds(
          await resolveSelectionIds({
            maxRows: selectionGroupMaxRows,
            maxIds: selectionGroupMaxIds,
            actionLabel: "Group",
            advice: "Narrow the selection and try again.",
          }),
        );
        setIsGroupOpen(true);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      if (pendingActionRef.current === actionId) {
        pendingActionRef.current = null;
        setLoadingActionIds([]);
      }
    }
  };

  const copySelectedRows = async (
    columnMode: CopyColumnMode,
    includeHeaders: boolean,
  ) => {
    const fields = columns
      .filter((column) => columnMode === "all" || columnVisibility[column.id])
      .map((column) => column.id);
    const rows = await resolveActionRows(fields, selectionCopyMaxRows, "Copy");
    await navigator.clipboard.writeText(
      serializeResourceRows(rows, columns, fields, "txt", includeHeaders, ";"),
    );
    toast.success(
      `Copied ${rows.length.toLocaleString()} selected ${(rows.length === 1 ? singularLabel : label).toLowerCase()}`,
    );
  };

  const redirect = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const signInHref = `/sign-in?redirect=${encodeURIComponent(redirect)}`;
  const noGenomesReason = `No genomes are associated with this ${singularLabel.toLowerCase()}`;
  // While one owned action resolves, the others would overwrite the shared IDs, so
  // only the actions this component dispatches are disabled. Entries the owning
  // collection dispatches itself keep working.
  const resolvingActionId = loadingActionIds.at(0);
  const mergedDisabledActions: Partial<Record<SearchActionId, string>> = {
    ...(resolvingActionId
      ? Object.fromEntries(
          actionIds
            .filter((id) => id !== resolvingActionId)
            .map((id) => [id, "Another selection action is still resolving."]),
        )
      : {}),
    ...disabledActions,
    ...(hasNoAssociatedGenomes
      ? {
          genomes: noGenomesReason,
          services: noGenomesReason,
          group: noGenomesReason,
        }
      : {}),
  };
  // Stay `undefined` rather than `{}` when nothing is disabled: the bar's prop is
  // optional and consumers assert on its absence.
  const resolvedDisabledActions = Object.keys(mergedDisabledActions).length
    ? mergedDisabledActions
    : undefined;

  return (
    <>
      <SearchActionBar
        selectedCount={selectedCount}
        searchType={searchType}
        guideUrl={guideUrl}
        enabledActions={[...actionIds, ...(extraEnabledActionIds ?? [])]}
        loadingActionIds={loadingActionIds}
        actionPopovers={
          isAuthenticated
            ? undefined
            : {
                group: (
                  <>
                    <p className="font-medium">Sign in required</p>
                    <p className="text-muted-foreground">
                      Sign in to create or update a {groupCopy.title}.
                    </p>
                    <Button
                      className="mt-1 w-full"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={signInHref} />}
                    >
                      Sign In
                    </Button>
                  </>
                ),
              }
        }
        disabledActions={resolvedDisabledActions}
        onError={onError}
        onAction={(actionId) => {
          void runAction(actionId);
        }}
      />
      <CollectionCopyDialog
        open={isCopyOpen}
        onOpenChange={setIsCopyOpen}
        label={label}
        selectedCount={selectedCount}
        onCopy={copySelectedRows}
      />
      <SelectionServiceChooser
        open={isServiceOpen}
        onOpenChange={setIsServiceOpen}
        label={label}
        hasSelectableServices={hasSelectableServices}
        ids={selectionIds}
        kind={idKind}
        workspaceUsername={user ? workspaceUsername(user) : undefined}
        signInHref={signInHref}
      />
      {user && (
        <SelectionToGroupDialog
          open={isGroupOpen}
          onOpenChange={setIsGroupOpen}
          ids={selectionIds}
          groupKind={idKind}
          defaultFolder={`/${workspaceUsername(user)}/home/${groupCopy.title}s`}
          onCreate={async (folderPath, name) => {
            await workspaceRepository.createIdGroup({
              path: folderPath.replace(/\/$/, ""),
              name,
              ...groupCopy.createInput,
              ids: selectionIds,
            });
            invalidateWorkspace(queryClient);
            toast.success(`Created ${groupCopy.title} ${name}`);
          }}
          onAppend={async (path) => {
            await workspaceRepository.appendToIdGroup({
              path,
              idField: groupCopy.createInput.idField,
              ids: selectionIds,
            });
            invalidateWorkspace(queryClient);
            toast.success(`Updated ${groupCopy.title}`);
          }}
        />
      )}
    </>
  );
}
