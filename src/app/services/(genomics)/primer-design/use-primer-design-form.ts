"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { toast } from "sonner";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import {
  defaultPrimerDesignFormValues,
  primerDesignFormSchema,
  type PrimerDesignFormData,
} from "@/lib/forms/(genomics)/primer-design/primer-design-form-schema";
import {
  primerAdvancedFields,
  primerArrayFields,
  primerDesignRerunInputType,
  primerScalarFields,
  stripPrimerMarkers,
  validatePrimerDesignSequence,
  type MarkerType,
} from "@/lib/forms/(genomics)/primer-design/primer-design-form-utils";
import { primerDesignService } from "@/lib/forms/(genomics)/primer-design/primer-design-service";
import type { WorkspaceObject } from "@/lib/services/workspace/types";

export function usePrimerDesignForm() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const sequenceTextValueRef = useRef("");
  const sequenceTextIdRef = useRef("");
  const workspaceFastaValueRef = useRef("");
  const isRestoringValueRef = useRef(false);
  const selectionRangeRef = useRef({ start: 0, end: 0 });

  const form = useForm({
    defaultValues: defaultPrimerDesignFormValues,
    validators: { onChange: primerDesignFormSchema },
    onSubmit: async ({ value }) => {
      if (value.input_type === "sequence_text") {
        const validation = validatePrimerDesignSequence(
          value.sequence_input ?? "",
        );
        if (!validation.isValid) {
          toast.error(validation.message);
          form.setFieldMeta("sequence_input", (previous) => ({
            ...previous,
            errorMap: { ...previous.errorMap, onChange: validation.message },
          }));
          return;
        }
      }
      await runtime.submitFormData(value as PrimerDesignFormData);
    },
  });

  const inputType = useSelector(form.store, (state) => state.values.input_type);
  const sequenceInput = useSelector(
    form.store,
    (state) => state.values.sequence_input,
  );
  const outputPath = useSelector(
    form.store,
    (state) => state.values.output_path,
  );
  const canSubmit = useSelector(form.store, (state) => state.canSubmit);
  const sequenceValidation =
    inputType === "workspace_fasta" || !sequenceInput
      ? null
      : validatePrimerDesignSequence(sequenceInput);

  useEffect(() => {
    form.setFieldMeta("sequence_input", (previous) => ({
      ...previous,
      errorMap: {
        ...previous.errorMap,
        onChange:
          sequenceValidation && !sequenceValidation.isValid
            ? sequenceValidation.message
            : undefined,
      },
    }));
  }, [sequenceValidation, form]);

  function handleSequenceValueChange(value: string) {
    form.setFieldValue("sequence_input", value);
    if (inputType === "sequence_text") sequenceTextValueRef.current = value;
    const validation = validatePrimerDesignSequence(value);
    form.setFieldMeta("sequence_input", (previous) => ({
      ...previous,
      errorMap: {
        ...previous.errorMap,
        onChange: validation.isValid ? undefined : validation.message,
      },
    }));
    if (!validation.isValid) return;
    if (validation.sanitizedSequence !== value) {
      form.setFieldValue("sequence_input", validation.sanitizedSequence);
      if (inputType === "sequence_text") {
        sequenceTextValueRef.current = validation.sanitizedSequence;
      }
    }
    if (validation.header && !form.state.values.SEQUENCE_ID?.trim()) {
      form.setFieldValue("SEQUENCE_ID", validation.header);
      sequenceTextIdRef.current = validation.header;
    }
  }

  function handleSequenceSelect(
    event: React.SyntheticEvent<HTMLTextAreaElement>,
  ) {
    selectionRangeRef.current = {
      start: event.currentTarget.selectionStart,
      end: event.currentTarget.selectionEnd,
    };
  }

  function updateSequenceWithMarkers(marker: MarkerType) {
    const sequence = form.state.values.sequence_input ?? "";
    if (!sequence) return;
    if (marker === "clear") {
      handleSequenceValueChange(stripPrimerMarkers(sequence));
      return;
    }
    const { start, end } = selectionRangeRef.current;
    if (start === end) {
      toast.error("Select a region in the sequence before applying markers.");
      return;
    }
    const headerEnd = sequence.startsWith(">") ? sequence.indexOf("\n") : -1;
    if (headerEnd >= 0 && start <= headerEnd) {
      toast.error("Markers cannot be added to the FASTA header.");
      return;
    }
    const markers = {
      exclude: ["<", ">"],
      target: ["[", "]"],
      include: ["{", "}"],
    } as const;
    const [open, close] = markers[marker];
    handleSequenceValueChange(
      sequence.slice(0, start) +
        open +
        sequence.slice(start, end) +
        close +
        sequence.slice(end),
    );
  }

  function restoreWorkspaceFasta() {
    if (!workspaceFastaValueRef.current) {
      form.setFieldValue("sequence_input", "");
      return;
    }
    isRestoringValueRef.current = true;
    form.setFieldValue("sequence_input", workspaceFastaValueRef.current);
    setTimeout(() => (isRestoringValueRef.current = false), 200);
  }

  function handleInputTypeChange(value: string) {
    const nextType = value as PrimerDesignFormData["input_type"];
    const currentValue = form.state.values.sequence_input || "";
    if (form.state.values.input_type === "sequence_text") {
      sequenceTextValueRef.current = currentValue;
      sequenceTextIdRef.current = form.state.values.SEQUENCE_ID || "";
    } else if (form.state.values.input_type === "workspace_fasta") {
      workspaceFastaValueRef.current = currentValue;
    }
    form.setFieldValue("input_type", nextType);
    if (nextType === "sequence_text") {
      form.setFieldValue("sequence_input", sequenceTextValueRef.current);
      form.setFieldValue("SEQUENCE_ID", sequenceTextIdRef.current);
    } else if (nextType === "workspace_fasta") {
      restoreWorkspaceFasta();
    }
  }

  function handleWorkspaceSelection(object: WorkspaceObject) {
    const path = object.path || "";
    form.setFieldValue("sequence_input", path);
    if (inputType === "workspace_fasta") workspaceFastaValueRef.current = path;
  }

  function handleSelectedWorkspaceObjectChange(object: WorkspaceObject | null) {
    if (isRestoringValueRef.current || inputType !== "workspace_fasta") return;
    if (object) {
      const path = object.path || "";
      form.setFieldValue("sequence_input", path);
      workspaceFastaValueRef.current = path;
    } else if (form.state.values.sequence_input) {
      form.setFieldValue("sequence_input", "");
      workspaceFastaValueRef.current = "";
    }
  }

  const runtime = useServiceRuntime({
    definition: primerDesignService,
    form,
    rerun: {
      onApply: (data, targetForm) => {
        const type = primerDesignRerunInputType(data.input_type);
        if (type) targetForm.setFieldValue("input_type", type);
        const sequence =
          typeof data.sequence_input === "string" ? data.sequence_input : "";
        targetForm.setFieldValue("sequence_input", sequence);
        if (type === "workspace_fasta") {
          isRestoringValueRef.current = true;
          workspaceFastaValueRef.current = sequence;
          setTimeout(() => (isRestoringValueRef.current = false), 200);
        } else {
          const id =
            typeof data.SEQUENCE_ID === "string" ? data.SEQUENCE_ID : "";
          targetForm.setFieldValue("SEQUENCE_ID", id);
          sequenceTextValueRef.current = sequence;
          sequenceTextIdRef.current = id;
        }
        if (typeof data.PRIMER_PICK_INTERNAL_OLIGO === "boolean") {
          targetForm.setFieldValue(
            "PRIMER_PICK_INTERNAL_OLIGO",
            data.PRIMER_PICK_INTERNAL_OLIGO,
          );
        }
        for (const field of primerArrayFields) {
          const value = data[field];
          if (value !== undefined) {
            targetForm.setFieldValue(
              field,
              Array.isArray(value)
                ? (value as string[])
                : typeof value === "string"
                  ? value.trim().split(/\s+/).filter(Boolean)
                  : [],
            );
          }
        }
        for (const field of primerScalarFields) {
          const value = data[field];
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            targetForm.setFieldValue(field, String(value));
          }
        }
        if (primerAdvancedFields.some((field) => data[field] !== undefined)) {
          setShowAdvanced(true);
        }
      },
    },
  });

  function handleReset() {
    form.reset(defaultPrimerDesignFormValues);
    setShowAdvanced(false);
  }

  return {
    form,
    runtime,
    inputType,
    outputPath,
    canSubmit,
    sequenceValidation,
    showAdvanced,
    isOutputNameValid,
    setShowAdvanced,
    setIsOutputNameValid,
    handleSequenceValueChange,
    handleSequenceSelect,
    updateSequenceWithMarkers,
    handleInputTypeChange,
    handleWorkspaceSelection,
    handleSelectedWorkspaceObjectChange,
    setSequenceTextId: (value: string) => (sequenceTextIdRef.current = value),
    handleReset,
  };
}

export type PrimerDesignController = ReturnType<typeof usePrimerDesignForm>;
