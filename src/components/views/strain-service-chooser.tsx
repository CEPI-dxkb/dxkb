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
import type { WorkspaceRepository } from "@/lib/services/workspace/workspace-repository";

interface CreateIdGroupInput {
  path: string;
  name: string;
  type: "genome_group";
  idField: "genome_id";
  ids: string[];
}

type IdGroupWorkspaceRepository = WorkspaceRepository & {
  createIdGroup(input: CreateIdGroupInput): Promise<void>;
};

interface StrainServiceChooserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  genomeIds: readonly string[];
  workspaceUsername?: string;
  onRequireAuthentication?: (serviceHref: string) => void;
}

type ServiceChoice = "blast" | "viral-tree" | "viral-msa";

const serviceHrefs: Record<ServiceChoice, string> = {
  blast: "/services/blast",
  "viral-tree": "/services/viral-genome-tree",
  "viral-msa": "/services/msa-snp-analysis",
};

export function StrainServiceChooser({
  open,
  onOpenChange,
  genomeIds,
  workspaceUsername,
  onRequireAuthentication,
}: StrainServiceChooserProps) {
  const repository = useWorkspaceRepository(
    "authenticated",
  ) as IdGroupWorkspaceRepository;
  const [pendingService, setPendingService] = useState<ServiceChoice | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const createTemporaryGenomeGroup = async () => {
    if (!workspaceUsername) throw new Error("Sign in to use this service.");
    const directoryPath = `/${workspaceUsername}/home/._tmp_groups`;
    const groupName = `tmp_genome_group_${crypto.randomUUID()}`;
    await repository.createIdGroup({
      path: directoryPath,
      name: groupName,
      type: "genome_group",
      idField: "genome_id",
      ids: [...genomeIds],
    });
    return `${directoryPath}/${groupName}`;
  };

  const runService = async (service: ServiceChoice) => {
    if (!workspaceUsername) {
      onOpenChange(false);
      onRequireAuthentication?.(serviceHrefs[service]);
      return;
    }
    setPendingService(service);
    setError(null);
    try {
      if (service === "blast") {
        rerunJob(
          {
            blast_program: "blastn",
            db_type: "fna",
            db_source: "genome_list",
            db_precomputed_database: "selGenome",
            db_genome_list: [...genomeIds],
          },
          "Homology",
        );
      } else {
        const groupPath = await createTemporaryGenomeGroup();
        if (service === "viral-tree") {
          rerunJob(
            {
              tree_type: "viral_genome",
              sequences: [{ type: "genome_group", filename: groupPath }],
            },
            "GeneTree",
          );
        } else {
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
        }
      }
      onOpenChange(false);
    } catch (serviceError) {
      setError(
        serviceError instanceof Error
          ? serviceError.message
          : "Unable to open the selected service",
      );
    } finally {
      setPendingService(null);
    }
  };

  const disabled = pendingService !== null || genomeIds.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use selected Strains in a service</DialogTitle>
          <DialogDescription>
            Open a supported service with {genomeIds.length.toLocaleString()}{" "}
            genome
            {genomeIds.length === 1 ? "" : "s"} associated with the selected
            strains.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button disabled={disabled} onClick={() => void runService("blast")}>
            {pendingService === "blast" ? "Opening BLAST..." : "BLAST"}
          </Button>
          <Button
            disabled={disabled}
            onClick={() => void runService("viral-tree")}
          >
            {pendingService === "viral-tree"
              ? "Opening Viral Genome Tree..."
              : "Viral Genome Tree"}
          </Button>
          <Button
            disabled={disabled}
            onClick={() => void runService("viral-msa")}
          >
            {pendingService === "viral-msa"
              ? "Opening Viral MSA..."
              : "Viral MSA"}
          </Button>
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
