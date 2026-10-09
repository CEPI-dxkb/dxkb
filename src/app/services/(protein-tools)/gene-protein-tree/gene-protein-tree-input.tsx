"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import type { WorkspaceSelectorPreset } from "@/components/workspace/workspace-selector-presets";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardDescription,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceRadioGroup } from "@/components/services/form-ui/service-radio-group";
import { phylogeneticTreeInput } from "@/lib/services/info/phylogenetic-tree";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import type {
  GeneProteinTreeFormData,
  SequenceItem,
} from "@/lib/forms/(protein-tools)/gene-protein-tree/gene-protein-tree-form-schema";
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
            label="DNA/Protein Aligned FASTA"
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
            label="DNA/Protein Unaligned FASTA"
            preset={unalignedFastaPreset}
            value={selectedUnalignedFastaObject?.path}
            onChange={setSelectedUnalignedFastaObject}
            onAdd={() => {
              handleAddSequence("unaligned");
            }}
            ariaLabel="Add unaligned FASTA sequence"
            disabled={!selectedUnalignedFastaObject}
          />
          <SequenceItemsTable
            sequences={sequences}
            alphabet={alphabet}
            onRemove={removeSequence}
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
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={ariaLabel}
          onClick={onAdd}
          disabled={disabled}
        >
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}

function SequenceItemsTable({
  sequences,
  alphabet,
  onRemove,
}: {
  sequences: SequenceItem[];
  alphabet: GeneProteinTreeFormData["alphabet"];
  onRemove: (index: number) => void;
}) {
  const emptyMessage = (
    <span className="text-muted-foreground">No items selected.</span>
  );
  return (
    // The container is this wrapper, not the scrolling box, so a scrollbar
    // appearing inside the box does not flip the layout.
    <div className="@container">
      <div className="max-h-84 overflow-y-auto rounded-md border bg-background">
        {/* `table-fixed` lets the path column take what the Type and Remove
          columns leave and wrap (`wrap` cell), instead of widening the table
          past the box and hiding Remove. Below 32rem the Type column would
          squeeze the path (and its header) to a strip, so the type moves
          under the path and the column is hidden. */}
        <Table className="table-fixed">
          <TableHeader>
            <TableRow variant="static">
              <TableHead>Selected file / feature group</TableHead>
              <TableHead className="hidden w-48 @lg:table-cell">Type</TableHead>
              <TableHead className="w-20 text-center">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sequences.length === 0 ? (
              <TableRow variant="static">
                {/* A cell spanning a hidden column would add a column of its
                  own, so the narrow and wide layouts each get their span. */}
                <TableCell colSpan={2} className="text-center @lg:hidden">
                  {emptyMessage}
                </TableCell>
                <TableCell
                  colSpan={3}
                  className="hidden text-center @lg:table-cell"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              sequences.map((sequence, index) => (
                <TableRow
                  key={`${sequence.type}:${sequence.filename}`}
                  variant="static-striped"
                >
                  <TableCell variant="wrap">
                    <div>
                      {getDisplayName(
                        sequence.filename.split("/").pop() || sequence.filename,
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sequence.filename}
                    </div>
                    <div className="text-xs text-muted-foreground @lg:hidden">
                      {getSequenceTypeLabel(sequence.type, alphabet)}
                    </div>
                  </TableCell>
                  <TableCell className="hidden @lg:table-cell">
                    {getSequenceTypeLabel(sequence.type, alphabet)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      type="button"
                      variant="ghost-secondary"
                      size="icon"
                      aria-label="Remove selected sequence"
                      onClick={() => {
                        onRemove(index);
                      }}
                    >
                      <X size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <p className="px-3 py-2 text-xs text-muted-foreground">
          No mixing of DNA and Protein FASTA files is allowed.
        </p>
      </div>
    </div>
  );
}
