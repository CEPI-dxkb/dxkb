"use client";

import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  validateFastaForBlast,
  getBlastFastaErrorMessage,
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

export const FastaTextarea = React.memo(function FastaTextarea({
  id = "sequence-input",
  value,
  onChange,
  onValidationChange,
  inputType,
  placeholder = "Enter one or more source nucleotide or protein sequences to search. Requires FASTA format.",
  className,
  disabled = false,
  required = false,
  // showValidationStatus = true,
  debounceMs = 500,
}: FastaTextareaProps) {
  const [validationResult, setValidationResult] =
    React.useState<FastaValidationResult | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);
  const [debounceTimeout, setDebounceTimeout] =
    React.useState<NodeJS.Timeout | null>(null);

  const validateFasta = React.useCallback(
    (text: string) => {
      if (!text.trim()) {
        setValidationResult(null);
        onValidationChange?.(false, null);
        return;
      }

      const result = validateFastaForBlast(text, inputType);
      setValidationResult(result);
      onValidationChange?.(result.valid, result);
    },
    [inputType, onValidationChange],
  );

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      // Clear existing timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Set new timeout for validation
      setIsValidating(true);
      const timeout = setTimeout(() => {
        validateFasta(newValue);
        setIsValidating(false);
      }, debounceMs);

      setDebounceTimeout(timeout);
    },
    [onChange, debounceTimeout, debounceMs, validateFasta],
  );

  // Validate on mount if there's already a value
  React.useEffect(() => {
    if (value) {
      validateFasta(value);
    }
  }, [value, validateFasta]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  const getValidationIcon = () => {
    if (isValidating) {
      return <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />;
    }

    if (!validationResult) {
      return null;
    }

    if (validationResult.valid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }

    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getErrorMessage = () => {
    if (!validationResult || validationResult.valid) {
      return "";
    }

    return getBlastFastaErrorMessage(validationResult, inputType);
  };

  const errorMessage = getErrorMessage();
  const hasError = errorMessage.length > 0;

  return (
    <div className="space-y-2">
      <Textarea
        id={id}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "service-card-textarea",
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
});
