"use client";

import { Card } from "@/components/ui/card";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { SelectedSequencesTable } from "@/components/services/selected-sequences-table";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardDescription,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceAddButton } from "@/components/services/form-ui/service-add-button";
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
    selectedSequenceRows,
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
        <ServiceCardDescription>
          Choose genome group or FASTA files for tree.
        </ServiceCardDescription>
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
                <SelectedSequencesTable
                  heading="Selected genome group / FASTA file"
                  rows={selectedSequenceRows}
                  onRemove={removeSequence}
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
        <ServiceAddButton
          aria-label={ariaLabel}
          onClick={onAdd}
          disabled={disabled}
          pending={loading}
        />
      </div>
    </div>
  );
}
