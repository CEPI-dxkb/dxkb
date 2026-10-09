"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { toast } from "sonner";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { normalizeToArray } from "@/lib/rerun-utility";
import type { WorkspaceSelectorPreset } from "@/components/workspace/workspace-selector-presets";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import {
  availableMetadataFieldSections,
  createMetadataField,
  defaultMetadataFields,
  metadataFieldIdsFromJob,
  type MetadataField,
} from "@/lib/forms/genome-metadata-fields";
import {
  type GeneProteinTreeFormData,
  defaultGeneProteinTreeFormValues,
  geneProteinTreeFormSchema,
  dnaModels,
  proteinModels,
  type SequenceItem,
} from "@/lib/forms/(protein-tools)/gene-protein-tree/gene-protein-tree-form-schema";
import {
  getSequenceTypeLabel,
  checkDuplicateSequence,
  checkSequenceLimit,
  createSequenceItem,
  removeSequenceAtIndex,
} from "@/lib/forms/(protein-tools)/gene-protein-tree/gene-protein-tree-form-utils";
import { geneProteinTreeService } from "@/lib/forms/(protein-tools)/gene-protein-tree/gene-protein-tree-service";

export function useGeneProteinTree() {
  const [selectedFeatureGroupObject, setSelectedFeatureGroupObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedAlignedFastaObject, setSelectedAlignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedUnalignedFastaObject, setSelectedUnalignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>(
    defaultMetadataFields,
  );
  const [selectedMetadataField, setSelectedMetadataField] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const form = useForm({
    defaultValues: defaultGeneProteinTreeFormValues,
    validators: { onChange: geneProteinTreeFormSchema },
    onSubmit: async ({ value }) => runtime.submitFormData(value),
  });
  const alphabet = useSelector(form.store, (state) => state.values.alphabet);
  const sequences = useSelector(form.store, (state) => state.values.sequences);
  const outputPath = useSelector(
    form.store,
    (state) => state.values.output_path,
  );
  const canSubmit = useSelector(form.store, (state) => state.canSubmit);
  const substitutionModelOptions =
    alphabet === "DNA" ? dnaModels : proteinModels;

  function updateMetadataFields(nextFields: MetadataField[]) {
    setMetadataFields(nextFields);
    form.setFieldValue(
      "metadata_fields",
      nextFields.reduce<string[]>((ids, field) => {
        if (field.selected) ids.push(field.id);
        return ids;
      }, []),
    );
  }

  function handleReset() {
    form.reset(defaultGeneProteinTreeFormValues);
    setSelectedFeatureGroupObject(null);
    setSelectedAlignedFastaObject(null);
    setSelectedUnalignedFastaObject(null);
    updateMetadataFields(defaultMetadataFields);
    setSelectedMetadataField("");
    setShowAdvanced(false);
  }

  const runtime = useServiceRuntime({
    definition: geneProteinTreeService,
    form,
    onSuccess: handleReset,
    rerun: {
      onApply: (rerunData) => {
        if (rerunData.alphabet)
          form.setFieldValue(
            "alphabet",
            rerunData.alphabet as GeneProteinTreeFormData["alphabet"],
          );
        if (rerunData.trim_threshold != null)
          form.setFieldValue(
            "trim_threshold",
            String(rerunData.trim_threshold as string | number),
          );
        if (rerunData.gap_threshold != null)
          form.setFieldValue(
            "gap_threshold",
            String(rerunData.gap_threshold as string | number),
          );
        const rerunSequences = normalizeToArray<SequenceItem>(
          rerunData.sequences,
        );
        if (rerunSequences.length > 0)
          form.setFieldValue("sequences", rerunSequences);
        const fieldIds = metadataFieldIdsFromJob(rerunData);
        // Through updateMetadataFields, so the form's metadata_fields (what
        // is submitted) follows the table.
        if (fieldIds.length > 0)
          updateMetadataFields(fieldIds.map(createMetadataField));
      },
    },
  });

  function handleAlphabetChange(
    nextAlphabet: GeneProteinTreeFormData["alphabet"],
  ) {
    if (nextAlphabet === alphabet) return;
    form.setFieldValue("alphabet", nextAlphabet);
    form.setFieldValue(
      "substitution_model",
      nextAlphabet === "DNA" ? dnaModels[0].value : proteinModels[0].value,
    );
    const validTypes = new Set<SequenceItem["type"]>(
      nextAlphabet === "DNA"
        ? ["feature_group", "aligned_dna_fasta", "feature_dna_fasta"]
        : ["feature_group", "aligned_protein_fasta", "feature_protein_fasta"],
    );
    const filteredSequences = sequences.filter((sequence) =>
      validTypes.has(sequence.type),
    );
    if (filteredSequences.length !== sequences.length) {
      form.setFieldValue("sequences", filteredSequences);
      toast.info("Switched alphabet. Cleared incompatible sequences.");
    }
    setSelectedAlignedFastaObject(null);
    setSelectedUnalignedFastaObject(null);
  }

  const alignedFastaPreset: WorkspaceSelectorPreset =
    alphabet === "DNA" ? "alignedDnaFasta" : "alignedProteinFasta";
  const unalignedFastaPreset: WorkspaceSelectorPreset =
    alphabet === "DNA" ? "featureDnaFasta" : "featureProteinFasta";

  function handleAddSequence(source: "feature" | "aligned" | "unaligned") {
    let selectedObject: WorkspaceObject | null;
    let type: SequenceItem["type"];
    if (source === "feature") {
      selectedObject = selectedFeatureGroupObject;
      type = "feature_group";
    } else if (source === "aligned") {
      selectedObject = selectedAlignedFastaObject;
      type = alphabet === "DNA" ? "aligned_dna_fasta" : "aligned_protein_fasta";
    } else {
      selectedObject = selectedUnalignedFastaObject;
      type = alphabet === "DNA" ? "feature_dna_fasta" : "feature_protein_fasta";
    }
    if (!selectedObject?.path) {
      toast.error("No object selected", {
        description: "Please select a workspace object before adding.",
        closeButton: true,
      });
      return;
    }
    const currentSequences = form.state.values.sequences;
    if (checkDuplicateSequence(currentSequences, selectedObject.path, type)) {
      toast.error("Duplicate selection detected", {
        description: `${getSequenceTypeLabel(type, alphabet)} is already selected.`,
        closeButton: true,
      });
      return;
    }
    if (checkSequenceLimit(currentSequences)) {
      toast.error("Selection limit reached", {
        description: "A maximum of 5000 sequences can be added.",
        closeButton: true,
      });
      return;
    }
    form.setFieldValue("sequences", [
      ...currentSequences,
      createSequenceItem(selectedObject.path, type),
    ]);
    if (source === "feature") setSelectedFeatureGroupObject(null);
    else if (source === "aligned") setSelectedAlignedFastaObject(null);
    else setSelectedUnalignedFastaObject(null);
  }

  function removeSequence(index: number) {
    form.setFieldValue(
      "sequences",
      removeSequenceAtIndex(form.state.values.sequences, index),
    );
  }

  function handleMetadataSelection(value: string) {
    setSelectedMetadataField(value);
  }

  function addMetadataField() {
    if (!selectedMetadataField) return;
    const alreadySelected = metadataFields.some(
      (field) => field.selected && field.id === selectedMetadataField,
    );
    if (!alreadySelected)
      updateMetadataFields([
        createMetadataField(selectedMetadataField),
        ...metadataFields,
      ]);
    setSelectedMetadataField("");
  }

  const selectedMetadataFields = metadataFields.filter(
    (field) => field.selected,
  );

  function removeMetadataField(fieldId: string) {
    updateMetadataFields(
      metadataFields.map((field) =>
        field.id === fieldId ? { ...field, selected: false } : field,
      ),
    );
  }

  return {
    form,
    alphabet,
    sequences,
    outputPath,
    canSubmit,
    substitutionModelOptions,
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
    showAdvanced,
    setShowAdvanced,
    selectedMetadataField,
    handleMetadataSelection,
    addMetadataField,
    removeMetadataField,
    // A field already in the table is not offered again.
    metadataSections: availableMetadataFieldSections(
      new Set(selectedMetadataFields.map((field) => field.id)),
    ),
    selectedMetadataFields,
    isOutputNameValid,
    setIsOutputNameValid,
    handleReset,
    isSubmitting: runtime.isSubmitting,
    jobParamsDialogProps: runtime.jobParamsDialogProps,
  };
}

export type GeneProteinTreeController = ReturnType<typeof useGeneProteinTree>;
