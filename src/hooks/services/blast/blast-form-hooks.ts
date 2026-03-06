import { useEffect, useMemo, useState, useCallback } from "react";
import { useStore, type AnyFormApi } from "@tanstack/react-form";

import { getAvailableBlastDatabaseTypes, getDefaultBlastDatabaseType } from "@/lib/services/service-utils";
import type { BlastFormData } from "@/lib/forms/(genomics)/blast/blast-form-schema";
import type { FastaValidationResult } from "@/lib/fasta-validation";
import { validateFastaForBlast } from "@/lib/fasta-validation";

/**
 * Custom hook to manage BLAST database type availability
 */
export function useBlastDatabaseTypes(form: AnyFormApi) {
  const blastProgram = useStore(form.store, (s) => s.values.blast_program);
  const dbPrecomputedDatabase = useStore(form.store, (s) => s.values.db_precomputed_database);
  const dbType = useStore(form.store, (s) => s.values.db_type);

  const availableDatabaseTypes = useMemo(() => {
    if (blastProgram && dbPrecomputedDatabase) {
      return getAvailableBlastDatabaseTypes(blastProgram, dbPrecomputedDatabase);
    }
    return getAvailableBlastDatabaseTypes("blastn", "bacteria-archaea");
  }, [blastProgram, dbPrecomputedDatabase]);

  useEffect(() => {
    if (blastProgram && dbPrecomputedDatabase) {
      const isCurrentTypeAvailable = availableDatabaseTypes.some(
        (type) => type.value === dbType,
      );

      if (!isCurrentTypeAvailable && availableDatabaseTypes.length > 0) {
        const defaultType = getDefaultBlastDatabaseType(
          blastProgram,
          dbPrecomputedDatabase,
        );

        if (defaultType) {
          form.setFieldValue("db_type", defaultType as BlastFormData["db_type"]);
        }
      } else if (availableDatabaseTypes.length > 0 && !dbType) {
        const firstType = availableDatabaseTypes[0].value;
        form.setFieldValue("db_type", firstType as BlastFormData["db_type"]);
      }
    }
  }, [blastProgram, dbPrecomputedDatabase, dbType, form, availableDatabaseTypes]);

  return availableDatabaseTypes;
}

/**
 * Custom hook to track BLAST program changes
 */
export function useBlastProgramTracking(form: AnyFormApi) {
  const currentBlastProgram = useStore(form.store, (s) => s.values.blast_program);
  return currentBlastProgram || "blastn";
}

/**
 * Custom hook to manage FASTA validation
 */
export function useFastaValidation(form: AnyFormApi, currentBlastProgram: BlastFormData["blast_program"]) {
  const [fastaValidationResult, setFastaValidationResult] = useState<FastaValidationResult | null>(null);
  const [isFastaValid, setIsFastaValid] = useState(false);
  const [prevProgram, setPrevProgram] = useState(currentBlastProgram);

  const handleFastaValidationChange = useCallback((isValid: boolean, result: FastaValidationResult | null) => {
    setIsFastaValid(isValid);
    setFastaValidationResult(result);
  }, []);

  if (prevProgram !== currentBlastProgram) {
    setPrevProgram(currentBlastProgram);
    const currentFastaData = form.state.values.input_fasta_data;
    if (currentFastaData && form.state.values.input_source === "fasta_data") {
      const result = validateFastaForBlast(currentFastaData, currentBlastProgram);
      setFastaValidationResult(result);
      setIsFastaValid(result.valid);
    }
  }

  return {
    fastaValidationResult,
    isFastaValid,
    handleFastaValidationChange,
  };
}
