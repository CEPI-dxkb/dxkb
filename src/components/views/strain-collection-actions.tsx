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
  genomeIdsFromStrains,
  strainCopyMaxRows,
  strainGenomesMaxRows,
  strainGenomesMaxUrlLength,
  strainGroupMaxRows,
  strainServicesMaxRows,
} from "@/lib/strain-view";
import { serializeResourceRows } from "./resource-export";
import {
  StrainCopyDialog,
  type StrainCopyColumnMode,
} from "./strain-copy-dialog";
import { StrainServiceChooser } from "./strain-service-chooser";

/** Actions the Strain collection owns. Visibility and dispatch read the same list. */
export const strainActionIds = [
  "copyRows",
  "services",
  "genomes",
  "group",
] as const satisfies readonly SearchActionId[];

interface StrainCollectionActionsProps {
  selectedCount: number;
  guideUrl?: string;
  /** The one selected strain is known to have no genomes, so every action is a dead end. */
  hasNoAssociatedGenomes: boolean;
  columns: readonly DataTableColumn[];
  columnVisibility: Record<string, boolean>;
  /** Fetch the selected rows (or every matching row) with the supplied fields. */
  resolveActionRows: (
    fields: readonly string[],
    maxRows: number,
    actionLabel: string,
  ) => Promise<Record<string, unknown>[]>;
  onError: (message: string | null) => void;
}

/**
 * The Strain collection's action bar and its three dialogs. Kept out of
 * ResourceCollection so the auth, workspace-repository and query-client hooks this
 * behaviour needs mount only on the one resource that uses them.
 */
export function StrainCollectionActions({
  selectedCount,
  guideUrl,
  hasNoAssociatedGenomes,
  columns,
  columnVisibility,
  resolveActionRows,
  onError,
}: StrainCollectionActionsProps) {
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

  const resolveGenomeIds = async (maxRows: number, actionLabel: string) => {
    const rows = await resolveActionRows(["genome_ids"], maxRows, actionLabel);
    const ids = genomeIdsFromStrains(rows);
    if (ids.length === 0) {
      throw new Error("No genomes are associated with this selection.");
    }
    return ids;
  };

  const runAction = async (actionId: SearchActionId) => {
    onError(null);
    if (actionId === "copyRows") {
      setIsCopyOpen(true);
      return;
    }
    setLoadingActionIds([actionId]);
    try {
      if (actionId === "genomes") {
        const href = genomesHrefFromIds(
          await resolveGenomeIds(strainGenomesMaxRows, "Genomes"),
        );
        if (!href || href.length > strainGenomesMaxUrlLength) {
          throw new Error(
            "This selection contains too many genome IDs to open safely. Narrow the selection or create a Genome Group.",
          );
        }
        router.push(href);
      } else if (actionId === "services") {
        setGenomeIds(await resolveGenomeIds(strainServicesMaxRows, "Services"));
        setIsServiceOpen(true);
      } else if (actionId === "group" && isAuthenticated) {
        setGenomeIds(await resolveGenomeIds(strainGroupMaxRows, "Group"));
        setIsGroupOpen(true);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingActionIds([]);
    }
  };

  const copySelectedRows = async (
    columnMode: StrainCopyColumnMode,
    includeHeaders: boolean,
  ) => {
    const fields = columns
      .filter((column) => columnMode === "all" || columnVisibility[column.id])
      .map((column) => column.id);
    const rows = await resolveActionRows(fields, strainCopyMaxRows, "Copy");
    await navigator.clipboard.writeText(
      serializeResourceRows(rows, columns, fields, "txt", includeHeaders, ";"),
    );
    toast.success(
      `Copied ${rows.length.toLocaleString()} selected ${rows.length === 1 ? "strain" : "strains"}`,
    );
  };

  const redirect = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  return (
    <>
      <SearchActionBar
        selectedCount={selectedCount}
        searchType="strain"
        guideUrl={guideUrl}
        enabledActions={[...strainActionIds]}
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
                genomes: "No genomes are associated with this strain",
                services: "No genomes are associated with this strain",
                group: "No genomes are associated with this strain",
              }
            : undefined
        }
        onAction={(actionId) => {
          void runAction(actionId);
        }}
      />
      <StrainCopyDialog
        open={isCopyOpen}
        onOpenChange={setIsCopyOpen}
        selectedCount={selectedCount}
        onCopy={copySelectedRows}
      />
      <StrainServiceChooser
        open={isServiceOpen}
        onOpenChange={setIsServiceOpen}
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
