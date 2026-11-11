"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
} from "react";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import {
  ServiceLibraryAddButton,
  ServiceLibraryHeader,
} from "@/components/services/form-ui/service-library-header";
import { cn } from "@/lib/utils";
import { Library } from "@/types/services";
import { toast } from "sonner";
import {
  isWellFormedAccession,
  requestSraValidation,
  type SraValidationResult,
} from "@/lib/services/sra-validation";


const validationDebounceMs = 500;

interface SraRunAccessionWithValidationProps {
  title?: string;
  placeholder?: string;
  selectedLibraries: Library[];
  setSelectedLibraries: (libraries: Library[]) => void;
  disabled?: boolean;
  allowDuplicates?: boolean;
  onAdd?: (srrIds: string[], title?: string) => void;
  onChange?: (value: string) => void;
  label?: React.ReactNode;
  addButton?: React.ReactNode;
  showLabel?: boolean;
  showAddButton?: boolean;
  defaultValue?: string;
}

interface SraInputViewProps {
  showLabel: boolean;
  showAddButton: boolean;
  /**
   * `unverified`: the backend timed out on NCBI, so the accession is accepted
   * but its message is a warning.
   */
  validationStatus: "idle" | "validating" | "invalid" | "unverified" | "valid";
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
  const showHeader = showLabel || showAddButton;

  return (
    <div className="space-y-2">
      {showHeader && (
        <ServiceLibraryHeader
          title={showLabel ? (label ?? title) : undefined}
        >
          {showAddButton &&
            (addButton ?? (
              <ServiceLibraryAddButton
                aria-label="Add SRA run accession to selected libraries"
                onClick={onAdd}
                disabled={!accession.trim() || disabled}
                pending={isValidating}
              />
            ))}
        </ServiceLibraryHeader>
      )}
      <div className="space-y-2">
        <ServiceInput
          placeholder={placeholder}
          value={accession}
          onChange={onChange}
          onKeyDown={onKeyDown}
          disabled={disabled || isValidating}
          aria-invalid={validationStatus === "invalid" || undefined}
          variant={validationStatus === "valid" ? "valid" : "default"}
        />
        {/* Always mounted at one line's height, so the card does not grow and a
            screen reader hears results as a polite live region. */}
        <p
          role="status"
          className={cn(
            "min-h-5 text-sm",
            validationStatus === "validating" && "text-muted-foreground",
            validationStatus === "invalid" && "text-destructive",
            validationStatus === "unverified" && "text-warning",
            validationStatus === "valid" && "text-success",
          )}
        >
          {validationStatus === "valid"
            ? "Provided SRA is valid"
            : validationMessage}
        </p>
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
   * Monotonic id of the latest validation; a response may only touch state or
   * the cache while its id is current.
   */
  const validationRequestIdRef = useRef(0);
  const validationAbortRef = useRef<AbortController | null>(null);
  const selectedLibrariesRef = useRef(selectedLibraries);
  useLayoutEffect(() => {
    selectedLibrariesRef.current = selectedLibraries;
  }, [selectedLibraries]);

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
      // Emptying the input also drops any debounce timer or in-flight request,
      // or it would repopulate the message for an accession no longer visible.
      cancelPendingValidation();
      setSraAccession("");
      onChange?.("");
      setIsValidating(false);
      setValidationMessage("");
      setIsValidSra(false);
      validationCacheRef.current = null;
    }
  };

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

  // An accepted accession can still carry a message (a timeout's), so check
  // acceptance before reading the message as a failure.
  const validationStatus = isValidating
    ? "validating"
    : isValidSra
      ? validationMessage
        ? "unverified"
        : "valid"
      : validationMessage
        ? "invalid"
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
