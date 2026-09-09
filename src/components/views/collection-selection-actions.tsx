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
import { genomesHrefFromIds } from "@/lib/views/hrefs";
import {
  idsFromRows,
  selectionCopyMaxRows,
  selectionGenomesMaxRows,
  selectionGenomesMaxUrlLength,
  selectionGroupMaxRows,
  selectionServicesMaxRows,
} from "@/lib/views/collection-selection";
import { serializeResourceRows } from "./resource-export";
import {
  CollectionCopyDialog,
  type CopyColumnMode,
} from "./collection-copy-dialog";
import { SelectionServiceChooser } from "./selection-service-chooser";

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

interface CollectionSelectionActionsProps {
  /** Drives which SearchActionBar entries are in scope for this resource. */
  searchType: "strain" | "genome";
  /** Plural collection label, e.g. "Strains" or "Genomes". */
  label: string;
  /** The subset of actions this component dispatches itself. */
  actionIds: readonly SearchActionId[];
  /** Row field the selection's Genome IDs come from. */
  genomeIdField: string;
  selectedCount: number;
  guideUrl?: string;
  /** The one selected row is known to have no genomes, so every action is a dead end. */
  hasNoAssociatedGenomes?: boolean;
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
 * to a set of Genome IDs (Strains via `genome_ids`, Genomes via `genome_id`). Kept out
 * of ResourceCollection so the auth, workspace-repository and query-client hooks this
 * behaviour needs mount only on the resources that use them.
 */
export function CollectionSelectionActions({
  searchType,
  label,
  actionIds,
  genomeIdField,
  selectedCount,
  guideUrl,
  hasNoAssociatedGenomes = false,
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
  const [genomeIds, setGenomeIds] = useState<string[]>([]);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [loadingActionIds, setLoadingActionIds] = useState<SearchActionId[]>(
    [],
  );
  // "Strains" -> "Strain". Only used for the copied-rows toast.
  const singularLabel = label.replace(/s$/, "");

  const resolveGenomeIds = async (maxRows: number, actionLabel: string) => {
    const rows = await resolveActionRows([genomeIdField], maxRows, actionLabel);
    const ids = idsFromRows(rows, genomeIdField);
    if (ids.length === 0) {
      throw new Error("No genomes are associated with this selection.");
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
    setLoadingActionIds([actionId]);
    try {
      if (actionId === "genomes") {
        const href = genomesHrefFromIds(
          await resolveGenomeIds(selectionGenomesMaxRows, "Genomes"),
        );
        if (!href || href.length > selectionGenomesMaxUrlLength) {
          throw new Error(
            "This selection contains too many genome IDs to open safely. Narrow the selection or create a Genome Group.",
          );
        }
        router.push(href);
      } else if (actionId === "services") {
        setGenomeIds(
          await resolveGenomeIds(selectionServicesMaxRows, "Services"),
        );
        setIsServiceOpen(true);
      } else if (actionId === "group" && isAuthenticated) {
        setGenomeIds(await resolveGenomeIds(selectionGroupMaxRows, "Group"));
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
        enabledActions={[...actionIds]}
        loadingActionIds={loadingActionIds}
        actionPopovers={
          isAuthenticated
            ? undefined
            : {
                group: (
                  <>
                    <p className="font-medium">Sign in required</p>
                    <p className="text-muted-foreground">
                      Sign in to create or update a Genome Group.
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
                genomes: noGenomesReason,
                services: noGenomesReason,
                group: noGenomesReason,
              }
            : undefined
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
        genomeIds={genomeIds}
        workspaceUsername={user ? workspaceUsername(user) : undefined}
        onRequireAuthentication={(serviceHref) => {
          router.push(serviceHref);
        }}
      />
      {user && (
        <SelectionToGroupDialog
          open={isGroupOpen}
          onOpenChange={setIsGroupOpen}
          genomeIds={genomeIds}
          defaultFolder={`/${workspaceUsername(user)}/home/Genome Groups`}
          onCreate={async (folderPath, name) => {
            await workspaceRepository.createIdGroup({
              path: folderPath.replace(/\/$/, ""),
              name,
              type: "genome_group",
              idField: "genome_id",
              ids: genomeIds,
            });
            invalidateWorkspace(queryClient);
            toast.success(`Created Genome Group ${name}`);
          }}
          onAppend={async (path) => {
            await workspaceRepository.appendToIdGroup({
              path,
              idField: "genome_id",
              ids: genomeIds,
            });
            invalidateWorkspace(queryClient);
            toast.success("Updated Genome Group");
          }}
        />
      )}
    </>
  );
}
