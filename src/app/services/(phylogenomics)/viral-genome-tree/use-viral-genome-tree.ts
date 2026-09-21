"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { toast } from "sonner";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { normalizeToArray } from "@/lib/rerun-utility";
import {
  getGenomeIdsFromGroup,
  validateViralGenomes,
} from "@/lib/services/genome";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import * as ViralGenomeTree from "@/lib/forms/(phylogenomics)/viral-genome-tree/viral-genome-tree-form-schema";
import * as ViralGenomeTreeUtils from "@/lib/forms/(phylogenomics)/viral-genome-tree/viral-genome-tree-form-utils";
import { viralGenomeTreeService } from "@/lib/forms/(phylogenomics)/viral-genome-tree/viral-genome-tree-service";

export interface MetadataField {
  id: string;
  name: string;
  selected: boolean;
}

export function useViralGenomeTree() {
  const [selectedGenomeGroupObject, setSelectedGenomeGroupObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedAlignedFastaObject, setSelectedAlignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedUnalignedFastaObject, setSelectedUnalignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>(
    ViralGenomeTree.defaultMetadataFields as MetadataField[],
  );
  const [selectedMetadataField, setSelectedMetadataField] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [isValidatingGenomeGroup, setIsValidatingGenomeGroup] = useState(false);
  const genomeGroupRequest = useRef(0);

  const form = useForm({
    defaultValues: ViralGenomeTree.defaultViralGenomeTreeFormValues,
    validators: { onChange: ViralGenomeTree.viralGenomeTreeFormSchema },
    onSubmit: async ({ value }) => runtime.submitFormData(value),
  });
  const sequences = useSelector(form.store, (state) => state.values.sequences);
  const canSubmit = useSelector(form.store, (state) => state.canSubmit);

  useEffect(() => {
    const selectedFields = metadataFields.reduce<string[]>((ids, field) => {
      if (field.selected) ids.push(field.id);
      return ids;
    }, []);
    form.setFieldValue("metadata_fields", selectedFields);
  }, [metadataFields, form]);

  function handleReset() {
    genomeGroupRequest.current += 1;
    setIsValidatingGenomeGroup(false);
    form.reset(ViralGenomeTree.defaultViralGenomeTreeFormValues);
    setSelectedGenomeGroupObject(null);
    setSelectedAlignedFastaObject(null);
    setSelectedUnalignedFastaObject(null);
    setMetadataFields(ViralGenomeTree.defaultMetadataFields);
    setSelectedMetadataField("");
    setShowAdvanced(false);
  }

  const runtime = useServiceRuntime({
    definition: viralGenomeTreeService,
    form,
    onSuccess: handleReset,
    rerun: {
      onApply: (rerunData, rerunForm) => {
        if (rerunData.trim_threshold != null) {
          rerunForm.setFieldValue(
            "trim_threshold",
            String(rerunData.trim_threshold as string | number),
          );
        }
        if (rerunData.gap_threshold != null) {
          rerunForm.setFieldValue(
            "gap_threshold",
            String(rerunData.gap_threshold as string | number),
          );
        }
        const rerunSequences =
          normalizeToArray<ViralGenomeTree.ViralGenomeSequenceItem>(
            rerunData.sequences,
          );
        if (rerunSequences.length > 0) {
          rerunForm.setFieldValue("sequences", rerunSequences);
        }
        const fieldIds = normalizeToArray<string>(
          rerunData.genome_metadata_fields,
        );
        if (fieldIds.length > 0) {
          setMetadataFields(
            fieldIds.map(ViralGenomeTreeUtils.createMetadataField),
          );
        }
      },
    },
  });

  const selectedMetadataIds = metadataFields.reduce<Set<string>>(
    (ids, field) => {
      if (field.selected) ids.add(field.id);
      return ids;
    },
    new Set(),
  );
  const availableMetadataOptions = ViralGenomeTree.getMetadataSelectOptions(
    ViralGenomeTreeUtils.formatMetadataLabel,
  ).filter(
    (option) => option.isLabel || !selectedMetadataIds.has(option.value),
  );
  const selectableMetadataOptions = availableMetadataOptions.reduce<
    { value: string; label: string }[]
  >((options, field) => {
    if (!field.isLabel) {
      options.push({ value: field.value, label: field.label });
    }
    return options;
  }, []);
  const selectedMetadataFields = metadataFields.filter(
    (field) => field.selected,
  );

  async function handleAddGenomeGroup() {
    if (!selectedGenomeGroupObject?.path) {
      toast.error("No object selected", {
        description: "Please select a workspace object before adding.",
        closeButton: true,
      });
      return;
    }
    const inputValue = selectedGenomeGroupObject.path;
    const currentSequences = form.state.values.sequences;
    if (
      ViralGenomeTreeUtils.checkDuplicateSequence(
        currentSequences,
        inputValue,
        "genome_group",
      )
    ) {
      toast.error("Duplicate selection detected", {
        description: "This genome group is already selected.",
        closeButton: true,
      });
      return;
    }
    if (ViralGenomeTreeUtils.checkSequenceLimit(currentSequences)) {
      toast.error("Selection limit reached", {
        description: "A maximum of 5000 sequences can be added.",
        closeButton: true,
      });
      return;
    }

    const request = ++genomeGroupRequest.current;
    setIsValidatingGenomeGroup(true);
    try {
      const genomeIds = await getGenomeIdsFromGroup(inputValue);
      if (request !== genomeGroupRequest.current) return;
      if (genomeIds.length === 0) {
        toast.error("Empty genome group", {
          description: "The selected genome group is empty.",
          closeButton: true,
        });
        setIsValidatingGenomeGroup(false);
        return;
      }
      const validation = await validateViralGenomes(genomeIds, {
        maxGenomeLength: 250000,
      });
      if (request !== genomeGroupRequest.current) return;
      if (!validation.allValid) {
        const errors = Object.values(validation.errors).filter(Boolean);
        toast.error("Genome group validation failed", {
          description:
            errors.length > 0
              ? errors.join("\n")
              : "Invalid genome group. Please check that all genomes are viruses with single contigs.",
          duration: 10000,
          closeButton: true,
        });
        setIsValidatingGenomeGroup(false);
        return;
      }
      const latestSequences = form.state.values.sequences;
      if (
        ViralGenomeTreeUtils.checkDuplicateSequence(
          latestSequences,
          inputValue,
          "genome_group",
        )
      ) {
        toast.error("Duplicate selection detected", {
          description: "This genome group is already selected.",
          closeButton: true,
        });
        setIsValidatingGenomeGroup(false);
        return;
      }
      if (ViralGenomeTreeUtils.checkSequenceLimit(latestSequences)) {
        toast.error("Selection limit reached", {
          description: "A maximum of 5000 sequences can be added.",
          closeButton: true,
        });
        setIsValidatingGenomeGroup(false);
        return;
      }
      form.setFieldValue("sequences", [
        ...latestSequences,
        ViralGenomeTreeUtils.createSequenceItem(inputValue, "genome_group"),
      ]);
      setSelectedGenomeGroupObject((current) =>
        current?.path === inputValue ? null : current,
      );
      toast.success("Genome group added", {
        description: `Added genome group with ${String(genomeIds.length)} genome${genomeIds.length === 1 ? "" : "s"}.`,
        closeButton: true,
      });
    } catch (error) {
      if (request !== genomeGroupRequest.current) return;
      console.error("Failed to validate genome group:", error);
      toast.error("Validation error", {
        description:
          error instanceof Error
            ? error.message
            : "Failed to validate genome group",
        closeButton: true,
      });
    }
    if (request === genomeGroupRequest.current) {
      setIsValidatingGenomeGroup(false);
    }
  }

  function handleAddSequence(source: "aligned" | "unaligned") {
    const selectedObject =
      source === "aligned"
        ? selectedAlignedFastaObject
        : selectedUnalignedFastaObject;
    const type: ViralGenomeTree.ViralGenomeSequenceItem["type"] =
      source === "aligned" ? "aligned_dna_fasta" : "feature_dna_fasta";
    if (!selectedObject?.path) {
      toast.error("No object selected", {
        description: "Please select a workspace object before adding.",
        closeButton: true,
      });
      return;
    }
    const currentSequences = form.state.values.sequences;
    if (
      ViralGenomeTreeUtils.checkDuplicateSequence(
        currentSequences,
        selectedObject.path,
        type,
      )
    ) {
      toast.error("Duplicate selection detected", {
        description: `${ViralGenomeTreeUtils.getSequenceTypeLabel(type)} is already selected.`,
        closeButton: true,
      });
      return;
    }
    if (ViralGenomeTreeUtils.checkSequenceLimit(currentSequences)) {
      toast.error("Selection limit reached", {
        description: "A maximum of 5000 sequences can be added.",
        closeButton: true,
      });
      return;
    }
    form.setFieldValue("sequences", [
      ...currentSequences,
      ViralGenomeTreeUtils.createSequenceItem(selectedObject.path, type),
    ]);
    if (source === "aligned") setSelectedAlignedFastaObject(null);
    else setSelectedUnalignedFastaObject(null);
  }

  function removeSequence(index: number) {
    form.setFieldValue(
      "sequences",
      ViralGenomeTreeUtils.removeSequenceAtIndex(
        form.state.values.sequences,
        index,
      ),
    );
  }

  function handleMetadataSelection(value: string) {
    setSelectedMetadataField(
      ViralGenomeTree.isMetadataLabel(value) ? "" : value,
    );
  }

  function addMetadataField() {
    if (!selectedMetadataField) return;
    if (!selectedMetadataIds.has(selectedMetadataField)) {
      setMetadataFields((fields) => [
        ViralGenomeTreeUtils.createMetadataField(selectedMetadataField),
        ...fields,
      ]);
    }
    setSelectedMetadataField("");
  }

  function removeMetadataField(fieldId: string) {
    setMetadataFields((fields) =>
      fields.map((field) =>
        field.id === fieldId ? { ...field, selected: false } : field,
      ),
    );
  }

  const selectedItemsForTable = sequences.map((sequence, index) => ({
    id: String(index),
    name: ViralGenomeTreeUtils.getDisplayName(
      sequence.filename.split("/").pop() || sequence.filename,
    ),
    type: ViralGenomeTreeUtils.getSequenceTypeLabel(sequence.type),
    description: sequence.filename,
  }));

  return {
    form,
    canSubmit,
    isOutputNameValid,
    setIsOutputNameValid,
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
    showAdvanced,
    setShowAdvanced,
    selectedMetadataField,
    handleMetadataSelection,
    addMetadataField,
    removeMetadataField,
    availableMetadataOptions,
    selectableMetadataOptions,
    selectedMetadataFields,
    handleReset,
    isSubmitting: runtime.isSubmitting,
    jobParamsDialogProps: runtime.jobParamsDialogProps,
  };
}

export type ViralGenomeTreeController = ReturnType<typeof useViralGenomeTree>;
