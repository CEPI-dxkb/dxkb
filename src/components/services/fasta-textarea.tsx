"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ServiceTextarea } from "@/components/services/form-ui/service-input";
import { cn } from "@/lib/utils";
import {
  validateFastaForBlast,
  getFastaErrorMessage,
  FastaValidationResult,
} from "@/lib/fasta-validation";

export interface FastaTextareaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (
    isValid: boolean,
    result: FastaValidationResult | null,
  ) => void;
  inputType: "blastn" | "blastp" | "blastx" | "tblastn";
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  showValidationStatus?: boolean;
  debounceMs?: number;
  /** The form's own error for the field (e.g. "required"), shown when the FASTA itself has none. */
  fieldError?: string | null;
}

export function FastaTextarea({
  id = "sequence-input",
  value,
  onChange,
  onValidationChange,
  inputType,
  placeholder = "Enter one or more source nucleotide or protein sequences to search. Requires FASTA format.",
  className,
  disabled = false,
  required: _required = false,
  // showValidationStatus = true,
  debounceMs = 500,
  fieldError,
}: FastaTextareaProps) {
  const [validationResult, setValidationResult] =
    useState<FastaValidationResult | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validateFasta = useEffectEvent((text: string) => {
    if (!text.trim()) {
      setValidationResult(null);
      onValidationChange?.(false, null);
      return;
    }

    const result = validateFastaForBlast(text, inputType);
    setValidationResult(result);
    onValidationChange?.(result.valid, result);
  });

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValidationResult(null);
    onValidationChange?.(false, null);
    onChange(event.target.value);
  };

  useEffect(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      validateFasta(value);
      debounceTimeoutRef.current = null;
    }, debounceMs);

    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [value, inputType, debounceMs]);

  const getErrorMessage = () => {
    if (!validationResult || validationResult.valid) {
      return "";
    }

    return getFastaErrorMessage(validationResult, inputType.toUpperCase());
  };

  const errorMessage = getErrorMessage() || fieldError || "";
  const hasError = errorMessage.length > 0;
  const validMessage =
    validationResult?.valid && validationResult.numseq > 0
      ? `✓ Valid FASTA with ${String(validationResult.numseq)} sequence${validationResult.numseq !== 1 ? "s" : ""}`
      : "";

  return (
    <div className="space-y-2">
      <ServiceTextarea
        id={id}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        variant={!hasError && validationResult?.valid ? "valid" : undefined}
        className={className}
      />

      {/* One line, always present: the FASTA error, the form's error, the
          valid count, or nothing. Every state renders the same plain text
          in the same reserved height, so the card does not resize as the
          state changes. */}
      <p
        role="status"
        className={cn(
          "min-h-5 text-sm",
          hasError ? "text-destructive" : "text-success",
        )}
      >
        {hasError ? errorMessage : validMessage}
      </p>
    </div>
  );
}
