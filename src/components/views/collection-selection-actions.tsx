"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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
  selectionGroupMaxRows,
  selectionListMaxUrlLength,
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
  // "Strains" -> "Strain". Only used for the copied-rows toast and the no-genomes
  // reason, so labels that do not pluralize by suffix pass their own singular.
  const singularLabel = singularLabelProp ?? label.replace(/s$/, "");
  const groupCopy = groupTargetByKind[idKind];

  const resolveSelectionIds = async (maxRows: number, actionLabel: string) => {
    const fields = typeof idField === "string" ? [idField] : idField;
    const rows = await resolveActionRows(fields, maxRows, actionLabel);
    const ids = idsFromRows(rows, idField);
    if (ids.length === 0) {
      throw new Error(`No ${idKind}s are associated with this selection.`);
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
    setLoadingActionIds([actionId]);
    try {
      if (actionId === "genomes") {
        const href = genomesHrefFromIds(
          await resolveSelectionIds(selectionGenomesMaxRows, "Genomes"),
        );
        if (!href || href.length > selectionListMaxUrlLength) {
          throw new Error(
            "This selection contains too many genome IDs to open safely. Narrow the selection or create a Genome Group.",
          );
        }
        router.push(href);
      } else if (actionId === "ppiFeatures") {
        const href = featuresHrefFromIds(
          await resolveSelectionIds(selectionFeaturesMaxRows, "Features"),
        );
        if (!href || href.length > selectionListMaxUrlLength) {
          throw new Error(
            "This selection contains too many feature IDs to open safely. Narrow the selection or create a Feature Group.",
          );
        }
        router.push(href);
      } else if (actionId === "services") {
        setSelectionIds(
          await resolveSelectionIds(selectionServicesMaxRows, "Services"),
        );
        setIsServiceOpen(true);
      } else if (actionId === "group" && isAuthenticated) {
        setSelectionIds(
          await resolveSelectionIds(selectionGroupMaxRows, "Group"),
        );
        setIsGroupOpen(true);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingActionIds([]);
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
  const noGenomesReason = `No genomes are associated with this ${singularLabel.toLowerCase()}`;

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
                      render={
                        <Link
                          href={`/sign-in?redirect=${encodeURIComponent(redirect)}`}
                        />
                      }
                    >
                      Sign In
                    </Button>
                  </>
                ),
              }
        }
        disabledActions={
          hasNoAssociatedGenomes
            ? {
                ...disabledActions,
                genomes: noGenomesReason,
                services: noGenomesReason,
                group: noGenomesReason,
              }
            : disabledActions
        }
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
        onRequireAuthentication={(serviceHref) => {
          router.push(serviceHref);
        }}
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
