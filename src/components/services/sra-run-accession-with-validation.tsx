"use client";

import React, { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ChevronRight, Loader2 } from "lucide-react";
import { Label } from "../ui/label";
import { Library } from "@/types/services";
import { toast } from "sonner";

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
}: SraRunAccessionWithValidationProps) => {
  const [sraAccession, setSraAccession] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string>("");

  const handleAdd = async () => {
    const accession = sraAccession.trim();

    // Validate format: 3 letters followed by numbers (case insensitive)
    if (!accession.match(/^[a-z]{3}[0-9]+$/i)) {
      setValidationMessage("Your input is not valid. Hint: only one SRR at a time.");
      return;
    }

    setIsValidating(true);
    setValidationMessage(`Validating ${accession}...`);

    try {
      // Use our API proxy to avoid CORS issues
      const response = await fetch(
        `/api/services/sra-validation?accession=${encodeURIComponent(accession)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status >= 400 && response.status < 500) {
          setValidationMessage(errorData.error || `Your input ${accession} is not valid`);
        } else {
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        setIsValidating(false);
        return;
      }

      const data = await response.json();

      // Handle timeout case (accession is still added)
      if (data.timeout) {
        setValidationMessage("Timeout exceeded.");
        const isDuplicate = selectedLibraries.some(
          (lib) => lib.id === accession && lib.type === "sra",
        );

        if (!isDuplicate || allowDuplicates) {
          const newLibrary: Library = {
            id: accession,
            name: accession,
            type: "sra",
          };
          const updatedLibraries = [...selectedLibraries, newLibrary];
          setSelectedLibraries(updatedLibraries);

          if (onAdd) {
            onAdd([accession]);
          }

          // Clear input and validation message after successful add
          setSraAccession("");
          if (onChange) {
            onChange("");
          }
          setValidationMessage("");
        } else {
          toast.error("Duplicate SRA accession detected", {
            description: `SRA accession ${accession} has already been added.`,
          });
        }
        setIsValidating(false);
        return;
      }

      try {
        const { title: studyTitle, runs, isValid } = parseXmlAndExtract(data.xml);

        if (!isValid || runs.length === 0) {
          setValidationMessage("The accession is not a run id.");
          setIsValidating(false);
          return;
        }

        // Add each run ID to the libraries
        const newLibraries: Library[] = [];

        for (const runId of runs) {
          // Check for duplicates
          const isDuplicate = selectedLibraries.some(
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
          const updatedLibraries = [...selectedLibraries, ...newLibraries];
          setSelectedLibraries(updatedLibraries);

          // Call onAdd callback if provided
          if (onAdd) {
            onAdd(runs, studyTitle);
          }

          // Clear input and validation message after successful add
          setSraAccession("");
          if (onChange) {
            onChange("");
          }
          setValidationMessage("");
        }
      } catch (parseError) {
        console.error("Error parsing XML:", parseError);
        setValidationMessage("Failed to parse validation response");
      }
    } catch (error) {
      console.error("Error validating SRA accession:", error);
      if (error instanceof Error) {
        setValidationMessage(error.message || "Something went wrong during validation.");
      } else {
        setValidationMessage("Something went wrong during validation.");
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSraAccession(value);
    // Clear validation message when user starts typing
    if (validationMessage) {
      setValidationMessage("");
    }
    // Notify parent of value change
    if (onChange) {
      onChange(value);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="service-card-label">{title}</Label>
        <div className="bg-border mx-4 h-px flex-1" />
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
      </div>
      <div className="space-y-2">
        <Input
          className="service-card-input"
          placeholder={placeholder}
          value={sraAccession}
          onChange={handleInputChange}
          disabled={disabled || isValidating}
        />
        {validationMessage && (
          <p
            className={`text-sm ${
              validationMessage.includes("Validating")
                ? "text-muted-foreground"
                : "text-destructive"
            }`}
            dangerouslySetInnerHTML={{ __html: validationMessage }}
          />
        )}
      </div>
    </div>
  );
};

export default SraRunAccessionWithValidation;
