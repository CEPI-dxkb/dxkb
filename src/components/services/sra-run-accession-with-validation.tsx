"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Library } from "@/types/services";
import { toast } from "sonner";
import {
  isWellFormedAccession,
  requestSraValidation,
  type SraValidationResult,
} from "@/lib/services/sra-validation";

import { ChevronRight, Loader2 } from "lucide-react";

const validationDebounceMs = 500;

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
  /** Pre-populate the accession input (e.g. for rerun). */
  defaultValue?: string;
}

interface SraInputViewProps {
  showLabel: boolean;
  showAddButton: boolean;
  validationStatus: "idle" | "validating" | "invalid" | "valid";
  title: string;
  placeholder: string;
  label?: React.ReactNode;
  addButton?: React.ReactNode;
  accession: string;
  disabled: boolean;
  validationMessage: string;
  onAdd: () => void;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

function SraInputView({
  showLabel,
  showAddButton,
  validationStatus,
  title,
  placeholder,
  label,
  addButton,
  accession,
  disabled,
  validationMessage,
  onAdd,
  onChange,
  onKeyDown,
}: SraInputViewProps) {
  const isValidating = validationStatus === "validating";
  // The divider is part of the header, so the header disappears only when
  // neither the label nor the add button is rendered.
  const showHeader = showLabel || showAddButton;

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center justify-between">
          {showLabel &&
            (label ?? <Label className="service-card-label">{title}</Label>)}
          <div className="mx-4 h-px flex-1 bg-border" />
          {showAddButton &&
            (addButton ?? (
              <Button
                variant="outline"
                size="icon"
                aria-label="Add SRA run accession to selected libraries"
                onClick={onAdd}
                disabled={!accession.trim() || disabled || isValidating}
              >
                {isValidating ? (
                  <Loader2 className="size-4 animate-spin" />
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
          value={accession}
          onChange={onChange}
          onKeyDown={onKeyDown}
          disabled={disabled || isValidating}
        />
        {validationMessage && (
          <p
            className={`text-sm ${
              isValidating ? "text-muted-foreground" : "text-destructive"
            }`}
          >
            {validationMessage}
          </p>
        )}
        {validationStatus === "valid" && !validationMessage && (
          <p className="text-sm text-muted-foreground">Provided SRA is valid</p>
        )}
      </div>
    </div>
  );
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
  defaultValue = "",
}: SraRunAccessionWithValidationProps) => {
  const [sraAccession, setSraAccession] = useState(defaultValue);
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string>("");
  const [isValidSra, setIsValidSra] = useState(false);
  const validationCacheRef = useRef<{
    accession: string;
    result: SraValidationResult;
  } | null>(null);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Monotonic id of the most recently started validation. A response may only
   * touch validation state or the cache while its id is still the current one,
   * so an older in-flight request cannot overwrite a newer accession's result.
   */
  const validationRequestIdRef = useRef(0);
  const validationAbortRef = useRef<AbortController | null>(null);
  const selectedLibrariesRef = useRef(selectedLibraries);
  useLayoutEffect(() => {
    selectedLibrariesRef.current = selectedLibraries;
  }, [selectedLibraries]);

  /**
   * Invalidates the in-flight request (if any) so its response is ignored, and
   * aborts the underlying fetch. Also clears any debounce timer that has not
   * fired yet.
   */
  const cancelPendingValidation = () => {
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
      validationTimerRef.current = null;
    }
    validationRequestIdRef.current += 1;
    validationAbortRef.current?.abort();
    validationAbortRef.current = null;
  };

  useEffect(() => {
    // Unmount only: stop any in-flight response from updating state.
    return () => {
      validationRequestIdRef.current += 1;
      validationAbortRef.current?.abort();
      validationAbortRef.current = null;
    };
  }, []);

  const applyValidationResult = (
    accession: string,
    result: SraValidationResult,
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
      // Emptying the input must also drop any debounce timer or in-flight
      // request for the accession just added, or it would repopulate the
      // message for an accession the user can no longer see.
      cancelPendingValidation();
      setSraAccession("");
      onChange?.("");
      setIsValidating(false);
      setValidationMessage("");
      setIsValidSra(false);
      validationCacheRef.current = null;
    }
  };

  /**
   * Shared automatic-add decision for both the debounced input path and the
   * `defaultValue` path: when the caller renders no add button, a freshly
   * validated accession is added unless every run is already selected.
   */
  const autoAddValidatedResult = (
    accession: string,
    result: SraValidationResult,
  ) => {
    if (showAddButton) return;
    const alreadyAdded = result.runs.every((runId) =>
      selectedLibrariesRef.current.some(
        (library) => library.type === "sra" && library.id === runId,
      ),
    );
    if (alreadyAdded) return;
    applyValidationResult(accession, result, { skipClear: true });
  };

  /**
   * Validates one accession and, when the request is still the current one,
   * reflects the outcome in validation state. Returns the result only for the
   * current request, so callers never act on a superseded response.
   */
  const validateAccession = async (
    accession: string,
  ): Promise<SraValidationResult | null> => {
    cancelPendingValidation();
    const requestId = validationRequestIdRef.current;
    const isCurrent = () => validationRequestIdRef.current === requestId;

    if (!isWellFormedAccession(accession)) {
      setValidationMessage(
        "Your input is not valid. Hint: only one SRR at a time.",
      );
      setIsValidSra(false);
      return null;
    }

    const controller = new AbortController();
    validationAbortRef.current = controller;

    setIsValidating(true);
    setIsValidSra(false);
    setValidationMessage(`Validating ${accession}...`);

    const outcome = await requestSraValidation(accession, controller.signal);
    if (!isCurrent()) return null;

    validationAbortRef.current = null;
    setIsValidating(false);

    switch (outcome.status) {
      case "invalid-format":
        setValidationMessage(
          "Your input is not valid. Hint: only one SRR at a time.",
        );
        setIsValidSra(false);
        return null;
      case "error":
        setValidationMessage(outcome.message);
        setIsValidSra(false);
        return null;
      case "not-run":
        setValidationMessage("The accession is not a run id.");
        setIsValidSra(false);
        return null;
      case "timeout":
        setValidationMessage("Timeout exceeded.");
        setIsValidSra(true);
        validationCacheRef.current = { accession, result: outcome.result };
        return outcome.result;
      case "valid":
        setValidationMessage("");
        setIsValidSra(true);
        validationCacheRef.current = { accession, result: outcome.result };
        return outcome.result;
    }
  };

  const scheduleValidation = (accession: string) => {
    cancelPendingValidation();
    if (!accession) {
      validationCacheRef.current = null;
      setIsValidating(false);
      setValidationMessage("");
      setIsValidSra(false);
      return;
    }
    validationTimerRef.current = setTimeout(() => {
      validationTimerRef.current = null;
      void validateAccession(accession).then((result) => {
        if (result) autoAddValidatedResult(accession, result);
      });
    }, validationDebounceMs);
  };

  const validateDefaultValue = useEffectEvent((accession: string) => {
    void validateAccession(accession).then((result) => {
      if (result) autoAddValidatedResult(accession, result);
    });
  });

  useEffect(() => {
    const accession = defaultValue.trim();
    if (accession) {
      validationTimerRef.current = setTimeout(() => {
        validationTimerRef.current = null;
        validateDefaultValue(accession);
      }, validationDebounceMs);
    }
    return () => {
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    };
  }, [defaultValue]);

  const handleAdd = async () => {
    const accession = sraAccession.trim();
    if (!accession) return;

    const cached = validationCacheRef.current;
    if (cached && cached.accession === accession) {
      applyValidationResult(accession, cached.result);
      return;
    }

    const result = await validateAccession(accession);
    if (result) {
      applyValidationResult(accession, result);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSraAccession(value);
    if (validationMessage) setValidationMessage("");
    setIsValidSra(false);
    scheduleValidation(value.trim());
    onChange?.(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !showAddButton) {
      e.preventDefault();
      void handleAdd();
    }
  };

  const validationStatus = isValidating
    ? "validating"
    : validationMessage
      ? "invalid"
      : isValidSra
        ? "valid"
        : "idle";

  return (
    <SraInputView
      showLabel={showLabel}
      showAddButton={showAddButton}
      validationStatus={validationStatus}
      title={title}
      placeholder={placeholder}
      label={label}
      addButton={addButton}
      accession={sraAccession}
      disabled={disabled}
      validationMessage={validationMessage}
      onAdd={() => {
        void handleAdd();
      }}
      onChange={handleInputChange}
      onKeyDown={handleKeyDown}
    />
  );
};

export default SraRunAccessionWithValidation;
