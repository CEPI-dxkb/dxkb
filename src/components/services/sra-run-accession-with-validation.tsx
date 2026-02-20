"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ChevronRight, Loader2 } from "lucide-react";
import { Label } from "../ui/label";
import { Library } from "@/types/services";
import { toast } from "sonner";

const VALIDATION_DEBOUNCE_MS = 500;

/** Strips HTML tags so only plain text is stored/displayed (XSS safety). */
function toPlainText(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim() || s;
}

interface ValidationResult {
  runs: string[];
  title: string;
}

interface SraRunAccessionWithValidationProps {
  title?: string;
  placeholder?: string;
  selectedLibraries: Library[];
  setSelectedLibraries: (libraries: Library[]) => void;
  disabled?: boolean;
  allowDuplicates?: boolean;
  onAdd?: (srrIds: string[], title?: string) => void;
  /** Called when the accession input value changes */
  onChange?: (value: string) => void;
  label?: React.ReactNode;
  addButton?: React.ReactNode;
  /** Whether to show the label. Defaults to true. */
  showLabel?: boolean;
  /** Whether to show the ChevronRight add button. Defaults to true. When false, add via Enter key. */
  showAddButton?: boolean;
}

// Validation is now done via API proxy to avoid CORS issues

/**
 * Parses XML text and extracts data using XPath-like queries
 */
function parseXmlAndExtract(xmlText: string): {
  title: string;
  runs: string[];
  isValid: boolean;
} {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  // Check for parsing errors
  const parseError = xmlDoc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Failed to parse XML response");
  }

  let title = "";

  // Extract study title
  try {
    const studyTitle = xmlDoc.evaluate(
      "//STUDY/DESCRIPTOR/STUDY_TITLE//text()",
      xmlDoc,
      null,
      XPathResult.STRING_TYPE,
      null,
    );
    title = studyTitle.stringValue.trim();
  } catch (e) {
    console.error("Could not get title from SRA record:", e);
  }

  const runs: string[] = [];
  const inputAccession = xmlDoc
    .evaluate(
      "//EXPERIMENT_PACKAGE/EXPERIMENT/@accession",
      xmlDoc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    )
    .singleNodeValue?.textContent?.toLowerCase();

  // Check if the input is an experiment ID
  const isExperimentId = !!inputAccession;

  // Extract all run accessions
  try {
    const runNodes = xmlDoc.evaluate(
      "//EXPERIMENT_PACKAGE_SET/EXPERIMENT_PACKAGE/RUN_SET/RUN/@accession",
      xmlDoc,
      null,
      XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
      null,
    );

    let runNode = runNodes.iterateNext();
    while (runNode) {
      const runId = runNode.textContent;
      if (runId) {
        runs.push(runId);
      }
      runNode = runNodes.iterateNext();
    }
  } catch (e) {
    console.error("Could not get run IDs from SRA record:", e);
  }

  return {
    title,
    runs,
    isValid: runs.length > 0,
  };
}

const SraRunAccessionWithValidation = ({
  title = "SRA Run Accession",
  placeholder = "SRR...",
  selectedLibraries,
  setSelectedLibraries,
  disabled = false,
  allowDuplicates = false,
  onAdd,
  onChange,
  label,
  addButton,
  showLabel = true,
  showAddButton = true,
}: SraRunAccessionWithValidationProps) => {
  const [sraAccession, setSraAccession] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string>("");
  const [isValidSra, setIsValidSra] = useState(false);
  const validationCacheRef = useRef<{ accession: string; result: ValidationResult } | null>(null);
  const selectedLibrariesRef = useRef(selectedLibraries);
  selectedLibrariesRef.current = selectedLibraries;

  const applyValidationResult = useCallback(
    (
      accession: string,
      result: ValidationResult,
      options?: { skipClear?: boolean },
    ) => {
      const { runs, title: studyTitle } = result;
      const skipClear = options?.skipClear ?? false;
      const current = selectedLibrariesRef.current;

      // Timeout case: accession is a single run
      if (runs.length === 1 && runs[0] === accession) {
        const isDuplicate = current.some(
          (lib) => lib.id === accession && lib.type === "sra",
        );
        if (isDuplicate && !allowDuplicates) {
          toast.error("Duplicate SRA accession detected", {
            description: `SRA accession ${accession} has already been added.`,
          });
          return;
        }
        const newLibrary: Library = {
          id: accession,
          name: accession,
          type: "sra",
        };
        setSelectedLibraries([...current, newLibrary]);
        onAdd?.([accession]);
      } else {
        const newLibraries: Library[] = [];
        for (const runId of runs) {
          const isDuplicate = current.some(
            (lib) => lib.id === runId && lib.type === "sra",
          );
          if (isDuplicate && !allowDuplicates) {
            toast.error("Duplicate SRA accession detected", {
              description: `SRA accession ${runId} has already been added.`,
            });
            continue;
          }
          newLibraries.push({
            id: runId,
            name: runId,
            type: "sra",
            ...(studyTitle && { title: studyTitle }),
          });
        }
        if (newLibraries.length > 0) {
          setSelectedLibraries([...current, ...newLibraries]);
          onAdd?.(runs, studyTitle);
        }
      }

      if (!skipClear) {
        setSraAccession("");
        onChange?.("");
        setValidationMessage("");
        setIsValidSra(false);
        validationCacheRef.current = null;
      }
    },
    [setSelectedLibraries, allowDuplicates, onAdd, onChange],
  );

  const validateAccession = useCallback(
    async (accession: string): Promise<ValidationResult | null> => {
      if (!accession.match(/^[a-z]{3}[0-9]+$/i)) {
        setValidationMessage("Your input is not valid. Hint: only one SRR at a time.");
        setIsValidSra(false);
        return null;
      }

      setIsValidating(true);
      setIsValidSra(false);
      setValidationMessage(`Validating ${accession}...`);

      try {
        const response = await fetch(
          `/api/services/sra-validation?accession=${encodeURIComponent(accession)}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          const rawError = errorData?.error != null ? String(errorData.error) : "";
          const plainError = rawError ? toPlainText(rawError) : `Your input ${accession} is not valid`;
          if (response.status >= 400 && response.status < 500) {
            setValidationMessage(plainError);
            setIsValidSra(false);
          } else {
            throw new Error(plainError);
          }
          return null;
        }

        const data = await response.json();

        if (data.timeout) {
          setValidationMessage("Timeout exceeded.");
          validationCacheRef.current = { accession, result: { runs: [accession], title: "" } };
          setIsValidSra(true);
          return validationCacheRef.current.result;
        }

        const { title: studyTitle, runs, isValid } = parseXmlAndExtract(data.xml);
        if (!isValid || runs.length === 0) {
          setValidationMessage("The accession is not a run id.");
          setIsValidSra(false);
          return null;
        }

        setValidationMessage("");
        setIsValidSra(true);
        const result: ValidationResult = { runs, title: studyTitle };
        validationCacheRef.current = { accession, result };
        return result;
      } catch (error) {
        console.error("Error validating SRA accession:", error);
        const raw = error instanceof Error ? error.message : "Something went wrong during validation.";
        setValidationMessage(toPlainText(raw));
        setIsValidSra(false);
        return null;
      } finally {
        setIsValidating(false);
      }
    },
    [],
  );

  // Debounced validation when user types
  useEffect(() => {
    const trimmed = sraAccession.trim();
    if (!trimmed) {
      setValidationMessage("");
      setIsValidSra(false);
      validationCacheRef.current = null;
      return;
    }

    const timer = setTimeout(() => {
      validateAccession(trimmed).then((result) => {
        // When there's no add button, auto-add the valid SRA so the form becomes valid (keep input visible)
        if (result && !showAddButton) {
          const libs = selectedLibrariesRef.current;
          const alreadyAdded = result.runs.every((runId) =>
            libs.some((lib) => lib.type === "sra" && lib.id === runId),
          );
          if (!alreadyAdded) {
            applyValidationResult(trimmed, result, { skipClear: true });
          }
        }
      });
    }, VALIDATION_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [sraAccession, validateAccession, showAddButton, applyValidationResult]);

  const handleAdd = useCallback(async () => {
    const accession = sraAccession.trim();
    if (!accession) return;

    const cached = validationCacheRef.current;
    if (cached && cached.accession === accession && cached.result) {
      applyValidationResult(accession, cached.result);
      return;
    }

    const result = await validateAccession(accession);
    if (result) {
      applyValidationResult(accession, result);
    }
  }, [sraAccession, validateAccession, applyValidationResult]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSraAccession(value);
    if (validationMessage) setValidationMessage("");
    setIsValidSra(false);
    onChange?.(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !showAddButton) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      {(showLabel || showAddButton) && (
        <div className="flex items-center justify-between">
          {showLabel ? (
            <>
              {label ?? (
                <Label className="service-card-label">{title}</Label>
              )}
              <div className="bg-border mx-4 h-px flex-1" />
            </>
          ) : (
            <div className="bg-border mx-4 h-px flex-1" />
          )}
          {showAddButton &&
            (addButton ?? (
              <Button
                variant="outline"
                size="icon"
                onClick={handleAdd}
                disabled={!sraAccession.trim() || disabled || isValidating}
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight size={16} />
                )}
              </Button>
            ))}
        </div>
      )}
      <div className="space-y-2">
        <Input
          className="service-card-input"
          placeholder={placeholder}
          value={sraAccession}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || isValidating}
        />
        {validationMessage && (
          <p
            className={`text-sm ${
              validationMessage.includes("Validating")
                ? "text-muted-foreground"
                : "text-destructive"
            }`}
          >
            {validationMessage}
          </p>
        )}
        {isValidSra && !validationMessage && (
          <p className="text-sm text-muted-foreground">Provided SRA is valid</p>
        )}
      </div>
    </div>
  );
};

export default SraRunAccessionWithValidation;
