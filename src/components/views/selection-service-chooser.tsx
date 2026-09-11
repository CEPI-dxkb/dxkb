"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { rerunJob } from "@/lib/rerun-utility";

/** Which ID kind the selection resolved to, and so which services accept it. */
export type SelectionServiceKind = "genome" | "feature";

interface SelectionServiceChooserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plural label of the collection the selection came from, e.g. "Strains". */
  label: string;
  ids: readonly string[];
  /** Genome IDs by default; Feature collections resolve `feature_id`s instead. */
  kind?: SelectionServiceKind;
  workspaceUsername?: string;
  onRequireAuthentication?: (serviceHref: string) => void;
  /**
   * False for collections no service accepts yet. Matches the Taxa Tree chooser:
   * the dialog still opens, it just reports that there is nothing to run.
   */
  hasSelectableServices?: boolean;
}

type ServiceChoice =
  | "blast"
  | "viral-tree"
  | "viral-msa"
  | "feature-blast"
  | "feature-blast-query"
  | "feature-blast-database"
  | "gene-tree"
  | "ha-subtype";

interface ServiceOption {
  choice: ServiceChoice;
  href: string;
  label: string;
  pendingLabel: string;
}

const genomeServiceOptions: readonly ServiceOption[] = [
  {
    choice: "blast",
    href: "/services/blast",
    label: "BLAST",
    pendingLabel: "Opening BLAST...",
  },
  {
    choice: "viral-tree",
    href: "/services/viral-genome-tree",
    label: "Viral Genome Tree",
    pendingLabel: "Opening Viral Genome Tree...",
  },
  {
    choice: "viral-msa",
    href: "/services/msa-snp-analysis",
    label: "Viral MSA",
    pendingLabel: "Opening Viral MSA...",
  },
];

const featureServiceOptions: readonly ServiceOption[] = [
  {
    choice: "feature-blast",
    href: "/services/blast",
    label: "BLAST",
    pendingLabel: "Opening BLAST...",
  },
  {
    choice: "gene-tree",
    href: "/services/gene-protein-tree",
    label: "Gene Tree",
    pendingLabel: "Opening Gene Tree...",
  },
  {
    choice: "ha-subtype",
    href: "/services/influenza-ha-subtype",
    label: "HA Subtype Numbering Conversion",
    pendingLabel: "Opening HA Subtype Numbering Conversion...",
  },
];

/**
 * BLAST can take a Feature Group either way, so legacy asks which side of the
 * search the selection belongs on before it opens the form.
 */
const featureBlastSourceOptions: readonly ServiceOption[] = [
  {
    choice: "feature-blast-query",
    href: "/services/blast",
    label: "Query",
    pendingLabel: "Opening BLAST...",
  },
  {
    choice: "feature-blast-database",
    href: "/services/blast",
    label: "Source",
    pendingLabel: "Opening BLAST...",
  },
];

export function SelectionServiceChooser({
  open,
  onOpenChange,
  label,
  ids,
  kind = "genome",
  workspaceUsername,
  onRequireAuthentication,
  hasSelectableServices = true,
}: SelectionServiceChooserProps) {
  const repository = useWorkspaceRepository("authenticated");
  const [pendingService, setPendingService] = useState<ServiceChoice | null>(
    null,
  );
  const [isChoosingBlastSource, setIsChoosingBlastSource] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTemporaryGroup = async () => {
    if (!workspaceUsername) throw new Error("Sign in to use this service.");
    const directoryPath = `/${workspaceUsername}/home/._tmp_groups`;
    const groupName = `tmp_${kind}_group_${crypto.randomUUID()}`;
    // Nothing provisions this hidden folder at first workspace access and the group
    // write does not create parents, so create it here. Workspace folder creation is
    // idempotent for an existing directory (see `ensureUserWorkspace`); if it fails
    // for any other reason the group write below reports the real error.
    try {
      await repository.createFolder(directoryPath);
    } catch {
      // Already there, or a failure the group write will surface with its own message.
    }
    await repository.createIdGroup({
      path: directoryPath,
      name: groupName,
      ...(kind === "feature"
        ? { type: "feature_group" as const, idField: "feature_id" as const }
        : { type: "genome_group" as const, idField: "genome_id" as const }),
      ids: [...ids],
    });
    return `${directoryPath}/${groupName}`;
  };

  const reportServiceError = (serviceError: unknown) => {
    setError(
      serviceError instanceof Error
        ? serviceError.message
        : "Unable to open the selected service",
    );
  };

  const runService = async ({ choice: service, href }: ServiceOption) => {
    // Direct BLAST carries the selected IDs in its rerun payload and writes no
    // workspace object, so it runs signed out too: the protected service route
    // redirects through sign-in with `rerun_key` intact.
    if (service === "blast") {
      setError(null);
      try {
        rerunJob(
          {
            blast_program: "blastn",
            db_type: "fna",
            db_source: "genome_list",
            db_precomputed_database: "selGenome",
            db_genome_list: [...ids],
          },
          "Homology",
        );
        onOpenChange(false);
      } catch (serviceError) {
        reportServiceError(serviceError);
      }
      return;
    }
    // Every remaining service writes a temporary workspace group first, so the
    // authentication decision comes before any further choice.
    if (!workspaceUsername) {
      onOpenChange(false);
      onRequireAuthentication?.(href);
      return;
    }
    if (service === "feature-blast") {
      setIsChoosingBlastSource(true);
      return;
    }
    setPendingService(service);
    setError(null);
    try {
      {
        const groupPath = await createTemporaryGroup();
        if (service === "viral-tree") {
          rerunJob(
            {
              tree_type: "viral_genome",
              sequences: [{ type: "genome_group", filename: groupPath }],
            },
            "GeneTree",
          );
        } else if (service === "viral-msa") {
          rerunJob(
            {
              input_status: "unaligned",
              input_type: "input_genomegroup",
              select_genomegroup: [groupPath],
              ref_type: "none",
              aligner: "Mafft",
              fasta_keyboard_input: "",
              alphabet: "dna",
              ref_string: "",
            },
            "MSA",
          );
        } else if (service === "feature-blast-query") {
          rerunJob(
            {
              blast_program: "blastn",
              db_type: "fna",
              input_source: "feature_group",
              input_feature_group: groupPath,
              db_precomputed_database: "bacteria-archaea",
            },
            "Homology",
          );
        } else if (service === "feature-blast-database") {
          rerunJob(
            {
              blast_program: "blastn",
              db_type: "fna",
              db_precomputed_database: "selFeatureGroup",
              db_feature_group: groupPath,
            },
            "Homology",
          );
        } else if (service === "gene-tree") {
          rerunJob(
            {
              tree_type: "gene",
              sequences: [{ type: "feature_group", filename: groupPath }],
            },
            "GeneTree",
          );
        } else {
          rerunJob(
            {
              input_source: "feature_group",
              input_feature_group: groupPath,
            },
            "HASubtypeNumberingConversion",
          );
        }
      }
      setIsChoosingBlastSource(false);
      onOpenChange(false);
    } catch (serviceError) {
      reportServiceError(serviceError);
    } finally {
      setPendingService(null);
    }
  };

  const disabled = pendingService !== null || ids.length === 0;
  const options = isChoosingBlastSource
    ? featureBlastSourceOptions
    : kind === "feature"
      ? featureServiceOptions
      : genomeServiceOptions;
  const idLabel = kind === "feature" ? "feature" : "genome";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setIsChoosingBlastSource(false);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isChoosingBlastSource
              ? "Select the BLAST source"
              : `Use selected ${label} in a service`}
          </DialogTitle>
          <DialogDescription>
            {!hasSelectableServices
              ? // `label` is always plural, so no article — "a Epitopes" was wrong.
                `Services that accept ${label} are not available yet.`
              : isChoosingBlastSource
                ? "Search with the selection as the query, or search against it as the source database."
                : `Open a supported service with ${ids.length.toLocaleString()} ${idLabel}${ids.length === 1 ? "" : "s"} from the current selection.`}
          </DialogDescription>
        </DialogHeader>
        {hasSelectableServices ? (
          <div className="grid gap-2">
            {options.map((option) => (
              <Button
                key={option.choice}
                disabled={disabled}
                onClick={() => void runService(option)}
              >
                {pendingService === option.choice
                  ? option.pendingLabel
                  : option.label}
              </Button>
            ))}
            {isChoosingBlastSource ? (
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  setIsChoosingBlastSource(false);
                }}
              >
                Back
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No selectable services
          </p>
        )}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
