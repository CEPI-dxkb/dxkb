import { useEffect, useState, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import type { BlastFormData } from "../../../lib/schemas/blast/blast-form-schema";
import { getAvailableBlastDatabaseTypes, getDefaultBlastDatabaseType } from "@/utils/services/service-utils";
import { validateFastaForBlast } from "@/utils/fasta-validation";
import type { FastaValidationResult } from "@/utils/fasta-validation";

/**
 * Custom hook to manage BLAST database type availability
 */
export function useBlastDatabaseTypes(form: UseFormReturn<BlastFormData>) {
  const [availableDatabaseTypes, setAvailableDatabaseTypes] = useState(
    getAvailableBlastDatabaseTypes("blastn", "bacteria-archaea")
  );

  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.blast_program && value.db_precomputed_database) {
        const newAvailableTypes = getAvailableBlastDatabaseTypes(
          value.blast_program,
          value.db_precomputed_database
        );
        setAvailableDatabaseTypes(newAvailableTypes);

        // If current db_type is not available, set to default
        const isCurrentTypeAvailable = newAvailableTypes.some(
          (type) => type.value === value.db_type
        );
        if (!isCurrentTypeAvailable) {
          const defaultType = getDefaultBlastDatabaseType(
            value.blast_program,
            value.db_precomputed_database
          );
          form.setValue("db_type", defaultType as BlastFormData["db_type"]);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  return availableDatabaseTypes;
}

/**
 * Custom hook to track BLAST program changes
 */
export function useBlastProgramTracking(form: UseFormReturn<BlastFormData>) {
  const [currentBlastProgram, setCurrentBlastProgram] = useState<BlastFormData["blast_program"]>("blastn");

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "blast_program" && value.blast_program) {
        setCurrentBlastProgram(value.blast_program);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  return currentBlastProgram;
}

/**
 * Custom hook to manage FASTA validation
 */
export function useFastaValidation(form: UseFormReturn<BlastFormData>, currentBlastProgram: BlastFormData["blast_program"]) {
  const [fastaValidationResult, setFastaValidationResult] = useState<FastaValidationResult | null>(null);
  const [isFastaValid, setIsFastaValid] = useState(false);

  const handleFastaValidationChange = useCallback((isValid: boolean, result: FastaValidationResult | null) => {
    setIsFastaValid(isValid);
    setFastaValidationResult(result);
  }, []);

  // Re-validate FASTA when blast program changes
  useEffect(() => {
    const currentFastaData = form.getValues("input_fasta_data");
    if (currentFastaData && form.getValues("input_source") === "fasta_data") {
      const result = validateFastaForBlast(currentFastaData, currentBlastProgram);
      setFastaValidationResult(result);
      setIsFastaValid(result.valid);
    }
  }, [currentBlastProgram, form]);

  return {
    fastaValidationResult,
    isFastaValid,
    handleFastaValidationChange,
  };
}

