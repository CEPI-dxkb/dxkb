import { useEffect, useState, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import type { BlastFormData } from "../../../lib/forms/(genomics)/blast/blast-form-schema";
import { getAvailableBlastDatabaseTypes, getDefaultBlastDatabaseType } from "@/lib/services/service-utils";
import { validateFastaForBlast } from "@/lib/fasta-validation";
import type { FastaValidationResult } from "@/lib/fasta-validation";

/**
 * Custom hook to manage BLAST database type availability
 */
export function useBlastDatabaseTypes(form: UseFormReturn<BlastFormData>) {
  const blastProgram = form.watch("blast_program");
  const dbPrecomputedDatabase = form.watch("db_precomputed_database");
  const dbType = form.watch("db_type");

  const [availableDatabaseTypes, setAvailableDatabaseTypes] = useState(
    getAvailableBlastDatabaseTypes("blastn", "bacteria-archaea"),
  );

  useEffect(() => {
    if (blastProgram && dbPrecomputedDatabase) {
      const computedTypes = getAvailableBlastDatabaseTypes(
        blastProgram,
        dbPrecomputedDatabase,
      );
      setAvailableDatabaseTypes(computedTypes);

      // If current db_type is not available, set to default
      const isCurrentTypeAvailable = computedTypes.some(
        (type) => type.value === dbType,
      );
      
      if (!isCurrentTypeAvailable && computedTypes.length > 0) {
        const defaultType = getDefaultBlastDatabaseType(
          blastProgram,
          dbPrecomputedDatabase,
        );
        
        if (defaultType) {
          form.setValue("db_type", defaultType as BlastFormData["db_type"], {
            shouldValidate: true,
            shouldDirty: false,
          });
        }
      } else if (computedTypes.length > 0 && !dbType) {
        const firstType = computedTypes[0].value;
        form.setValue("db_type", firstType as BlastFormData["db_type"], {
          shouldValidate: true,
          shouldDirty: false,
        });
      }
    }
  }, [blastProgram, dbPrecomputedDatabase, dbType, form]);

  return availableDatabaseTypes;
}

/**
 * Custom hook to track BLAST program changes
 */
export function useBlastProgramTracking(form: UseFormReturn<BlastFormData>) {
  const currentBlastProgram = form.watch("blast_program");
  return currentBlastProgram || "blastn";
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

