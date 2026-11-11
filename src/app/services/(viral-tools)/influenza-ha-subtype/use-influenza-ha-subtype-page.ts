import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { validateProteinFasta } from "@/lib/fasta-validation";
import {
  defaultInfluenzaHaSubtypeFormValues,
  influenzaHaSubtypeFormSchema,
} from "@/lib/forms/(viral-tools)/influenza-ha-subtype/influenza-ha-subtype-form-schema";
import { influenzaHaSubtypeService } from "@/lib/forms/(viral-tools)/influenza-ha-subtype/influenza-ha-subtype-service";

export function useInfluenzaHaSubtypePage() {
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [fastaValidationMessage, setFastaValidationMessage] = useState("");
  const [isFastaValid, setIsFastaValid] = useState(false);
  // The text that last passed validation on blur; the valid cue shows only while the value equals it.
  const [validatedFasta, setValidatedFasta] = useState("");
  const [fastaSequenceCount, setFastaSequenceCount] = useState(0);

  const form = useForm({
    defaultValues: defaultInfluenzaHaSubtypeFormValues,
    validators: { onChange: influenzaHaSubtypeFormSchema },
    onSubmit: async ({ value }) => runtime.submitFormData(value),
  });
  const outputPath = useSelector(
    form.store,
    (state) => state.values.output_path,
  );
  const watchedTypes = useSelector(form.store, (state) => state.values.types);
  const canSubmit = useSelector(form.store, (state) => state.canSubmit);
  const inputSource = useSelector(
    form.store,
    (state) => state.values.input_source,
  );
  const fastaData = useSelector(
    form.store,
    (state) => state.values.input_fasta_data,
  );

  function validateFastaData() {
    const trimmed = fastaData.trim();
    if (!trimmed) {
      setFastaValidationMessage("");
      setIsFastaValid(false);
      setValidatedFasta("");
      setFastaSequenceCount(0);
      return;
    }
    const result = validateProteinFasta(trimmed);
    setIsFastaValid(result.valid);
    setFastaSequenceCount(result.valid ? result.numseq : 0);
    setFastaValidationMessage(result.message || "");
    let settledFasta = fastaData;
    if (result.valid && result.trimFasta && result.trimFasta !== trimmed) {
      form.setFieldValue("input_fasta_data", result.trimFasta);
      settledFasta = result.trimFasta;
    }
    setValidatedFasta(result.valid ? settledFasta : "");
  }

  function handleReset() {
    form.reset(defaultInfluenzaHaSubtypeFormValues);
    setIsOutputNameValid(true);
    setFastaValidationMessage("");
    setIsFastaValid(false);
    setValidatedFasta("");
    setFastaSequenceCount(0);
  }

  const runtime = useServiceRuntime({
    definition: influenzaHaSubtypeService,
    form,
    onSuccess: handleReset,
  });
  const isFastaDataInvalid =
    inputSource === "fasta_data" && !!fastaData.trim() && !isFastaValid;

  return {
    form,
    outputPath,
    watchedTypeSet: new Set(watchedTypes),
    inputSource,
    fastaValidationMessage,
    validatedFasta,
    fastaSequenceCount,
    validateFastaData,
    handleReset,
    setIsOutputNameValid,
    isSubmitting: runtime.isSubmitting,
    jobParamsDialogProps: runtime.jobParamsDialogProps,
    isSubmitDisabled:
      !canSubmit ||
      !isOutputNameValid ||
      runtime.isSubmitting ||
      isFastaDataInvalid,
  };
}
