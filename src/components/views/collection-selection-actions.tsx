"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { CancelledError, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  SearchActionBar,
  type SearchActionId,
} from "@/components/search/search-action-bar";
import { noServicesReason } from "@/components/search/search-action-policy";
import type { DataTableColumn } from "@/components/shared/data-table";
import { useAuth } from "@/lib/auth/provider";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { invalidateWorkspace } from "@/lib/services/workspace/workspace-query-keys";
import { namedObjectConfirmation } from "@/lib/services/workspace/helpers";
import {
  parsePathSegments,
  workspaceUsername,
} from "@/lib/services/workspace/path-utils";
import { encodeQueryComponent, toQueryString } from "@/lib/url";
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
  label: string;
  singularLabel?: string;
  actionIds: readonly SearchActionId[];
  extraEnabledActionIds?: readonly SearchActionId[];
  /**
   * Several fields are pooled and de-duplicated (Interactions carry two
   * interactors a row).
   */
  idField: string | readonly string[];
  idKind?: SelectionServiceKind;
  selectedCount: number;
  guideUrl?: string;
  hasNoAssociatedGenomes?: boolean;
  disabledActions?: Partial<Record<SearchActionId, string>>;
  externalLoadingActionIds?: readonly SearchActionId[];
  hasSelectableServices?: boolean;
  columns: readonly DataTableColumn[];
  columnVisibility: Record<string, boolean>;
  resolveActionRows: (
    fields: readonly string[],
    maxRows: number,
    actionLabel: string,
  ) => Promise<Record<string, unknown>[]>;
  onError: (message: string | null) => void;
  onOtherAction?: (actionId: SearchActionId) => void;
}

// The group dialog loads on the group action's first run, preloaded while the
// selection's IDs resolve.
const SelectionToGroupDialog = dynamic(
  () =>
    import("@/components/workspace/selection-to-group-dialog").then(
      (module) => module.SelectionToGroupDialog,
    ),
  { ssr: false },
);

// A failed load is left to the render, which reports it.
function preloadGroupDialog(): void {
  import("@/components/workspace/selection-to-group-dialog").catch(
    () => undefined,
  );
}

function isOpenableListHref(href: string | null): href is string {
  return !!href && href.length <= selectionListMaxUrlLength;
}

/**
 * Kept out of ResourceCollection so the auth, workspace-repository and
 * query-client hooks mount only on resources that use them.
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
  externalLoadingActionIds = [],
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
  // Mounted from the first open on, so it keeps its close animation.
  const [hasOpenedGroup, setHasOpenedGroup] = useState(false);
  const [loadingActionIds, setLoadingActionIds] = useState<SearchActionId[]>(
    [],
  );
  const pendingActionRef = useRef<SearchActionId | null>(null);
  // Each dialog hands focus back to the button that opened it when it closes.
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const servicesButtonRef = useRef<HTMLButtonElement>(null);
  const groupButtonRef = useRef<HTMLButtonElement>(null);
  const singularLabel = singularLabelProp ?? label.replace(/s$/, "");
  const groupCopy = groupTargetByKind[idKind];

  /**
   * `maxRows` bounds the fetch; `maxIds` bounds what leaves the page, since one
   * row can contribute many IDs.
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
    // `selectionIds` is one shared slot; a ref rejects an overlapping
    // resolution in the same tick, which disabled state alone cannot.
    if (pendingActionRef.current) return;
    pendingActionRef.current = actionId;
    setLoadingActionIds([actionId]);
    const opensGroup = actionId === "group" && isAuthenticated;
    try {
      // `isOpenableListHref` also enforces the URL-length bound, which long
      // feature IDs hit well before 500 of them.
      if (actionId === "genomes") {
        const href = genomesHrefFromIds(
          await resolveSelectionIds({
            maxRows: selectionGenomesMaxRows,
            maxIds: selectionListMaxIds,
            actionLabel: "Genomes",
            advice: "Narrow the selection or create a Genome Group.",
          }),
        );
        if (!isOpenableListHref(href)) {
          onError(
            "This selection contains too many genome IDs to open safely. Narrow the selection or create a Genome Group.",
          );
        } else {
          router.push(href);
        }
      } else if (actionId === "ppiFeatures") {
        const href = featuresHrefFromIds(
          await resolveSelectionIds({
            maxRows: selectionFeaturesMaxRows,
            maxIds: selectionListMaxIds,
            actionLabel: "Features",
            advice: "Narrow the selection or create a Feature Group.",
          }),
        );
        if (!isOpenableListHref(href)) {
          onError(
            "This selection contains too many feature IDs to open safely. Narrow the selection or create a Feature Group.",
          );
        } else {
          router.push(href);
        }
      } else if (actionId === "services") {
        setSelectionIds(
          await resolveSelectionIds({
            maxRows: selectionServicesMaxRows,
            maxIds: selectionServicesMaxIds,
            actionLabel: "Services",
            advice: "Narrow the selection and try again.",
          }),
        );
        setIsServiceOpen(true);
      } else if (opensGroup) {
        preloadGroupDialog();
        setSelectionIds(
          await resolveSelectionIds({
            maxRows: selectionGroupMaxRows,
            maxIds: selectionGroupMaxIds,
            actionLabel: "Group",
            advice: "Narrow the selection and try again.",
          }),
        );
        setHasOpenedGroup(true);
        setIsGroupOpen(true);
      }
    } catch (error) {
      if (!(error instanceof CancelledError)) {
        onError(error instanceof Error ? error.message : String(error));
      }
    }
    if (pendingActionRef.current === actionId) {
      pendingActionRef.current = null;
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
    const rows = await resolveActionRows(
      fields,
      selectionCopyMaxRows,
      "Copy",
    ).catch((error: unknown) => {
      if (error instanceof CancelledError) return null;
      throw error;
    });
    if (!rows) return;
    await navigator.clipboard.writeText(
      serializeResourceRows(rows, columns, fields, "txt", includeHeaders, ";"),
    );
    toast.success(
      `Copied ${rows.length.toLocaleString()} selected ${(rows.length === 1 ? singularLabel : label).toLowerCase()} to your clipboard`,
    );
  };

  const query = toQueryString(new URLSearchParams(searchParams.toString()));
  const redirect = `${pathname}${query ? `?${query}` : ""}`;
  const signInHref = `/sign-in?redirect=${encodeQueryComponent(redirect)}`;
  const noGenomesReason = `No genomes are associated with this ${singularLabel.toLowerCase()}`;
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
    ...(hasSelectableServices
      ? {}
      : { services: noServicesReason(singularLabel, label, selectedCount) }),
  };
  // `undefined` rather than `{}` when nothing is disabled: consumers assert on
  // its absence.
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
        loadingActionIds={[...loadingActionIds, ...externalLoadingActionIds]}
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
        actionRefs={{
          copyRows: copyButtonRef,
          services: servicesButtonRef,
          group: groupButtonRef,
        }}
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
        finalFocus={copyButtonRef}
      />
      <SelectionServiceChooser
        open={isServiceOpen}
        onOpenChange={setIsServiceOpen}
        label={label}
        ids={selectionIds}
        kind={idKind}
        workspaceUsername={user ? workspaceUsername(user) : undefined}
        signInHref={signInHref}
        finalFocus={servicesButtonRef}
      />
      {user && hasOpenedGroup && (
        <SelectionToGroupDialog
          open={isGroupOpen}
          onOpenChange={setIsGroupOpen}
          finalFocus={groupButtonRef}
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
            toast.success(
              namedObjectConfirmation("Created", groupCopy.title, name),
            );
          }}
          onAppend={async (path) => {
            await workspaceRepository.appendToIdGroup({
              path,
              idField: groupCopy.createInput.idField,
              ids: selectionIds,
            });
            invalidateWorkspace(queryClient);
            toast.success(
              namedObjectConfirmation(
                "Updated",
                groupCopy.title,
                parsePathSegments(path).at(-1) ?? path,
              ),
            );
          }}
        />
      )}
    </>
  );
}
