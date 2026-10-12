import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { getFastaErrorMessage, validateFasta } from "@/lib/fasta-validation";
import {
  defaultSubspeciesClassificationFormValues,
  subspeciesClassificationFormSchema,
} from "@/lib/forms/(viral-tools)/subspecies-classification/subspecies-classification-form-schema";
import { subspeciesClassificationService } from "@/lib/forms/(viral-tools)/subspecies-classification/subspecies-classification-service";

export function useSubspeciesClassificationPage() {
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  // The text that last passed `validateFasta` on blur, or "" while none has.
  // The textarea shows its valid border only while its value still equals it,
  // so the cue goes as soon as the text changes, as the error does.
  const [validatedFasta, setValidatedFasta] = useState("");
  const form = useForm({
    defaultValues: defaultSubspeciesClassificationFormValues,
    validators: { onChange: subspeciesClassificationFormSchema },
    onSubmit: async ({ value }) => runtime.submitFormData(value),
  });
  const outputPath = useSelector(
    form.store,
    (state) => state.values.output_path,
  );
  const canSubmit = useSelector(form.store, (state) => state.canSubmit);
  const inputSource = useSelector(
    form.store,
    (state) => state.values.input_source,
  );

  function handleFastaBlur() {
    const value = form.state.values.input_fasta_data ?? "";
    if (!value.trim()) {
      setValidatedFasta("");
      return;
    }
    const result = validateFasta(value, "dna");
    setValidatedFasta(result.valid ? result.trimFasta : "");
    const error = getFastaErrorMessage(result, "Subspecies Classification");
    form.setFieldMeta("input_fasta_data", (previous) => ({
      ...previous,
      errors: result.valid ? [] : [error],
      errorMap: {
        ...previous.errorMap,
        onChange: result.valid ? undefined : error,
      },
    }));
    if (result.valid && result.trimFasta !== value) {
      form.setFieldValue("input_fasta_data", result.trimFasta);
    }
  }
  function handleReset() {
    form.reset(defaultSubspeciesClassificationFormValues);
    setIsOutputNameValid(true);
    setValidatedFasta("");
  }
  const runtime = useServiceRuntime({
    definition: subspeciesClassificationService,
    form,
    onSuccess: handleReset,
  });
  return {
    form,
    outputPath,
    inputSource,
    validatedFasta,
    handleFastaBlur,
    handleReset,
    setIsOutputNameValid,
    isSubmitting: runtime.isSubmitting,
    jobParamsDialogProps: runtime.jobParamsDialogProps,
    canSubmit: canSubmit && isOutputNameValid,
  };
}
