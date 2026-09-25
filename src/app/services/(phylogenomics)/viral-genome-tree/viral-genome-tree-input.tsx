"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SelectedItemsTable from "@/components/services/selected-items-table";
import { Spinner } from "@/components/ui/spinner";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { phylogeneticTreeInput } from "@/lib/services/info/phylogenetic-tree";
import type { ViralGenomeTreeController } from "./use-viral-genome-tree";

export function ViralGenomeTreeInput({
  controller,
}: {
  controller: ViralGenomeTreeController;
}) {
  const {
    form,
    selectedGenomeGroupObject,
    setSelectedGenomeGroupObject,
    selectedAlignedFastaObject,
    setSelectedAlignedFastaObject,
    selectedUnalignedFastaObject,
    setSelectedUnalignedFastaObject,
    isValidatingGenomeGroup,
    handleAddGenomeGroup,
    handleAddSequence,
    removeSequence,
    selectedItemsForTable,
  } = controller;

  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Input
          <DialogInfoPopup
            title={phylogeneticTreeInput.title}
            description={phylogeneticTreeInput.description}
            sections={phylogeneticTreeInput.sections}
          />
        </RequiredFormCardTitle>
        <CardDescription>
          Choose genome group or FASTA files for tree.
        </CardDescription>
      </ServiceCardHeader>
      <ServiceCardContent>
        <div className="space-y-4">
          <SequenceSelector
            label="Genome Group"
            preset="genomeGroup"
            value={selectedGenomeGroupObject?.path}
            onChange={setSelectedGenomeGroupObject}
            onAdd={() => void handleAddGenomeGroup()}
            ariaLabel="Add genome group"
            disabled={!selectedGenomeGroupObject || isValidatingGenomeGroup}
            loading={isValidatingGenomeGroup}
          />
          <SequenceSelector
            label="Aligned FASTA"
            preset="alignedDnaFastaOrContigs"
            value={selectedAlignedFastaObject?.path}
            onChange={setSelectedAlignedFastaObject}
            onAdd={() => {
              handleAddSequence("aligned");
            }}
            ariaLabel="Add aligned sequence"
            disabled={!selectedAlignedFastaObject || isValidatingGenomeGroup}
          />
          <SequenceSelector
            label="Unaligned FASTA"
            preset="featureDnaFasta"
            value={selectedUnalignedFastaObject?.path}
            onChange={setSelectedUnalignedFastaObject}
            onAdd={() => {
              handleAddSequence("unaligned");
            }}
            ariaLabel="Add unaligned sequence"
            disabled={!selectedUnalignedFastaObject || isValidatingGenomeGroup}
          />
          <form.Field name="sequences">
            {(field) => (
              <FieldItem>
                <SelectedItemsTable
                  title="Selected genome group / FASTA files"
                  items={selectedItemsForTable}
                  onRemove={(id) => {
                    removeSequence(parseInt(id, 10));
                  }}
                  className="max-h-84 overflow-y-auto"
                  allowDuplicates={false}
                  description="Selected genome groups and FASTA files will be used to construct the phylogenetic tree."
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
        </div>
      </ServiceCardContent>
    </Card>
  );
}

function SequenceSelector({
  label,
  preset,
  value,
  onChange,
  onAdd,
  ariaLabel,
  disabled,
  loading = false,
}: {
  label: string;
  preset: "genomeGroup" | "alignedDnaFastaOrContigs" | "featureDnaFasta";
  value?: string;
  onChange: ViralGenomeTreeController["setSelectedGenomeGroupObject"];
  onAdd: () => void;
  ariaLabel: string;
  disabled: boolean;
  loading?: boolean;
}) {
  return (
    <div className="space-y-2">
      <ServiceLabel>{label}</ServiceLabel>
      <div className="flex gap-2">
        <WorkspaceObjectSelector
          preset={preset}
          placeholder="Optional"
          onSelectedObjectChange={onChange}
          value={value}
          className="flex-1"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={ariaLabel}
          onClick={onAdd}
          disabled={disabled}
        >
          {loading ? <Spinner className="size-4" /> : <Plus size={16} />}
        </Button>
      </div>
    </div>
  );
}
