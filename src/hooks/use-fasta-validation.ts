"use client";

import { useState, useCallback, useMemo } from "react";
import {
  validateFastaForBlast,
  getBlastFastaErrorMessage,
  FastaValidationResult,
} from "@/lib/fasta-validation";

export interface UseFastaValidationOptions {
  inputType: "blastn" | "blastp" | "blastx" | "tblastn";
  debounceMs?: number;
}

export interface UseFastaValidationReturn {
  fastaText: string;
  setFastaText: (text: string) => void;
  validationResult: FastaValidationResult | null;
  isValid: boolean;
  errorMessage: string;
  isValidating: boolean;
  validateFasta: () => void;
}

export function useFastaValidation({
  inputType,
  debounceMs = 500,
}: UseFastaValidationOptions): UseFastaValidationReturn {
  const [fastaText, setFastaTextState] = useState("");
  const [validationResult, setValidationResult] =
    useState<FastaValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );

  const setFastaText = useCallback(
    (text: string) => {
      setFastaTextState(text);
      setIsValidating(true);

      // Clear existing timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Set new timeout for validation
      const timeout = setTimeout(() => {
        const result = validateFastaForBlast(text, inputType);
        setValidationResult(result);
        setIsValidating(false);
      }, debounceMs);

      setDebounceTimeout(timeout);
    },
    [inputType, debounceMs, debounceTimeout],
  );

  const validateFasta = useCallback(() => {
    if (fastaText.trim()) {
      setIsValidating(true);
      const result = validateFastaForBlast(fastaText, inputType);
      setValidationResult(result);
      setIsValidating(false);
    }
  }, [fastaText, inputType]);

  const isValid = useMemo(() => {
    return validationResult?.valid ?? false;
  }, [validationResult]);

  const errorMessage = useMemo(() => {
    if (!validationResult) return "";
    return getBlastFastaErrorMessage(validationResult, inputType);
  }, [validationResult, inputType]);

  return {
    fastaText,
    setFastaText,
    validationResult,
    isValid,
    errorMessage,
    isValidating,
    validateFasta,
  };
}
