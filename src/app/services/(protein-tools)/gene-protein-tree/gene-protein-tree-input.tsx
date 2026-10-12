"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { SelectedSequencesTable } from "@/components/services/selected-sequences-table";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import type { WorkspaceSelectorPreset } from "@/components/workspace/workspace-selector-presets";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardDescription,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceAddButton } from "@/components/services/form-ui/service-add-button";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceRadioGroup } from "@/components/services/form-ui/service-radio-group";
import { phylogeneticTreeInput } from "@/lib/services/info/phylogenetic-tree";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import type { GeneProteinTreeFormData } from "@/lib/forms/(protein-tools)/gene-protein-tree/gene-protein-tree-form-schema";
import {
  getDisplayName,
  getSequenceTypeLabel,
} from "@/lib/forms/(protein-tools)/gene-protein-tree/gene-protein-tree-form-utils";
import type { GeneProteinTreeController } from "./use-gene-protein-tree";

export function GeneProteinTreeInput({
  controller,
}: {
  controller: GeneProteinTreeController;
}) {
  const {
    form,
    alphabet,
    sequences,
    handleAlphabetChange,
    selectedFeatureGroupObject,
    setSelectedFeatureGroupObject,
    selectedAlignedFastaObject,
    setSelectedAlignedFastaObject,
    selectedUnalignedFastaObject,
    setSelectedUnalignedFastaObject,
    alignedFastaPreset,
    unalignedFastaPreset,
    handleAddSequence,
    removeSequence,
  } = controller;
  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Input
          <DialogInfoPopup {...phylogeneticTreeInput} />
        </RequiredFormCardTitle>
        <ServiceCardDescription>
          Choose fasta file or features for tree.
        </ServiceCardDescription>
      </ServiceCardHeader>
      <ServiceCardContent>
        <div className="space-y-4">
          <form.Field name="alphabet">
            {(field) => (
              <FieldItem>
                <ServiceRadioGroup
                  value={field.state.value}
                  onValueChange={(value) => {
                    if (value != null) {
                      handleAlphabetChange(
                        value as GeneProteinTreeFormData["alphabet"],
                      );
                    }
                  }}
                >
                  {(["DNA", "Protein"] as const).map((value) => (
                    <div key={value} className="flex items-center gap-3">
                      <RadioGroupItem value={value} id={value} />
                      <Label htmlFor={value}>{value}</Label>
                    </div>
                  ))}
                </ServiceRadioGroup>
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
          <SequenceSelector
            label="Feature Group"
            preset="featureGroup"
            value={selectedFeatureGroupObject?.path}
            onChange={setSelectedFeatureGroupObject}
            onAdd={() => {
              handleAddSequence("feature");
            }}
            ariaLabel="Add feature group sequence"
            disabled={!selectedFeatureGroupObject}
          />
          <SequenceSelector
            label={`${alphabet} Aligned FASTA`}
            preset={alignedFastaPreset}
            value={selectedAlignedFastaObject?.path}
            onChange={setSelectedAlignedFastaObject}
            onAdd={() => {
              handleAddSequence("aligned");
            }}
            ariaLabel="Add aligned FASTA sequence"
            disabled={!selectedAlignedFastaObject}
          />
          <SequenceSelector
            label={`${alphabet} Unaligned FASTA`}
            preset={unalignedFastaPreset}
            value={selectedUnalignedFastaObject?.path}
            onChange={setSelectedUnalignedFastaObject}
            onAdd={() => {
              handleAddSequence("unaligned");
            }}
            ariaLabel="Add unaligned FASTA sequence"
            disabled={!selectedUnalignedFastaObject}
          />
          <SelectedSequencesTable
            heading="Selected file / feature group"
            rows={sequences.map((sequence) => ({
              id: `${sequence.type}:${sequence.filename}`,
              name: getDisplayName(
                sequence.filename.split("/").pop() || sequence.filename,
              ),
              path: sequence.filename,
              typeLabel: getSequenceTypeLabel(sequence.type, alphabet),
            }))}
            onRemove={removeSequence}
            note="No mixing of DNA and Protein FASTA files is allowed."
          />
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
}: {
  label: string;
  preset: WorkspaceSelectorPreset;
  value?: string;
  onChange: (object: WorkspaceObject | null) => void;
  onAdd: () => void;
  ariaLabel: string;
  disabled: boolean;
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
        />
      </div>
    </div>
  );
}
