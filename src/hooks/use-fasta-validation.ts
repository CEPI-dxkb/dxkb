"use client";

import { useEffect, useRef, useState } from "react";
import {
  validateFastaForBlast,
  getFastaErrorMessage,
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
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  const setFastaText = (text: string) => {
    setFastaTextState(text);
    setIsValidating(true);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const timeout = setTimeout(() => {
      const result = validateFastaForBlast(text, inputType);
      setValidationResult(result);
      setIsValidating(false);
    }, debounceMs);

    debounceTimeoutRef.current = timeout;
  };

  const validateFasta = () => {
    if (fastaText.trim()) {
      setIsValidating(true);
      const result = validateFastaForBlast(fastaText, inputType);
      setValidationResult(result);
      setIsValidating(false);
    }
  };

  const isValid = validationResult?.valid ?? false;
  const errorMessage = validationResult
    ? getFastaErrorMessage(validationResult, inputType.toUpperCase())
    : "";

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
