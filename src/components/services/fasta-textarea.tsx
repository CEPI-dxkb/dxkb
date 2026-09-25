"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

  const errorMessage = getErrorMessage();
  const hasError = errorMessage.length > 0;

  return (
    <div className="space-y-2">
      <ServiceTextarea
        id={id}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          hasError && "border-red-500 focus-visible:ring-red-500",
          validationResult?.valid &&
            "border-green-500 focus-visible:ring-green-500",
          className,
        )}
      />

      {errorMessage && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-sm">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      {validationResult?.valid && validationResult.numseq > 0 && (
        <div className="text-sm text-green-600">
          ✓ Valid FASTA with {validationResult.numseq} sequence
          {validationResult.numseq !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
