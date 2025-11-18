import {
  DEFAULT_PRIMER_DESIGN_FORM_VALUES,
  type PrimerDesignFormData,
} from "./primer-design-form-schema";

export type PrimerSequenceValidationError =
  | "empty"
  | "multiple_records"
  | "invalid_characters"
  | "missing_sequence";

export interface PrimerSequenceValidationResult {
  isValid: boolean;
  message: string;
  sanitizedSequence: string;
  header: string | null;
  errorCode?: PrimerSequenceValidationError;
}

const MARKER_REGEX = /[<>\[\]\{\}]/g;
const ALLOWED_BASES_REGEX = /^[ACGTRYSWKMBDHVN.-]*$/i;

function normalizeNewlines(sequence: string) {
  return sequence.replace(/\r\n?/g, "\n");
}

export function sanitizePrimerDesignSequence(sequence: string): string {
  if (!sequence) {
    return "";
  }

  const normalized = normalizeNewlines(sequence).trim();
  if (!normalized) {
    return "";
  }

  const lines = normalized.split("\n");
  const sanitizedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith(">")) {
      sanitizedLines.push(trimmed);
    } else {
      sanitizedLines.push(trimmed.replace(/\s+/g, ""));
    }
  }

  return sanitizedLines.join("\n");
}

export function extractFastaHeader(sequence: string): string | null {
  if (!sequence) {
    return null;
  }

  const sanitized = sanitizePrimerDesignSequence(sequence);
  if (!sanitized.startsWith(">")) {
    return null;
  }

  const firstLineEnd = sanitized.indexOf("\n");
  if (firstLineEnd === -1) {
    return sanitized.slice(1).trim() || null;
  }

  return sanitized.slice(1, firstLineEnd).trim() || null;
}

export function stripPrimerMarkers(sequence: string): string {
  if (!sequence) {
    return "";
  }

  const normalized = normalizeNewlines(sequence);
  const lines = normalized.split("\n");

  return lines
    .map((line, index) => {
      if (index === 0 && line.trim().startsWith(">")) {
        return line.trim();
      }

      return line.replace(MARKER_REGEX, "");
    })
    .join("\n")
    .trim();
}

export function getSequenceForSubmission(sequence: string): string {
  if (!sequence) {
    return "";
  }

  const sanitized = sanitizePrimerDesignSequence(sequence);
  if (!sanitized) {
    return "";
  }

  const lines = sanitized.split("\n");
  if (lines[0]?.startsWith(">")) {
    return lines.slice(1).join("");
  }

  return lines.join("");
}

export function validatePrimerDesignSequence(
  sequence: string,
): PrimerSequenceValidationResult {
  const normalized = normalizeNewlines(sequence).trim();

  if (!normalized) {
    return {
      isValid: false,
      message: "Please provide a nucleotide sequence.",
      sanitizedSequence: "",
      header: null,
      errorCode: "empty",
    };
  }

  const sanitized = sanitizePrimerDesignSequence(sequence);
  const lines = sanitized.split("\n");

  const headerCount = lines.filter((line) => line.startsWith(">"))
    .length;
  if (headerCount > 1) {
    return {
      isValid: false,
      message:
        "Primer Design accepts only one sequence at a time. Please provide only one sequence.",
      sanitizedSequence: sanitized,
      header: extractFastaHeader(sanitized),
      errorCode: "multiple_records",
    };
  }

  const bodyLines = lines.filter((line) => !line.startsWith(">"));
  if (!bodyLines.length) {
    return {
      isValid: false,
      message: "Please provide a nucleotide sequence.",
      sanitizedSequence: sanitized,
      header: extractFastaHeader(sanitized),
      errorCode: "missing_sequence",
    };
  }

  let hasValidCharacters = false;

  for (const line of bodyLines) {
    const cleaned = line.replace(MARKER_REGEX, "");
    if (!cleaned) {
      continue;
    }
    hasValidCharacters = true;

    if (!ALLOWED_BASES_REGEX.test(cleaned)) {
      return {
        isValid: false,
        message:
          "This looks like an invalid sequence. Please provide a valid nucleotide sequence.",
        sanitizedSequence: sanitized,
        header: extractFastaHeader(sanitized),
        errorCode: "invalid_characters",
      };
    }
  }

  if (!hasValidCharacters) {
    return {
      isValid: false,
      message: "Please provide a nucleotide sequence.",
      sanitizedSequence: sanitized,
      header: extractFastaHeader(sanitized),
      errorCode: "missing_sequence",
    };
  }

  return {
    isValid: true,
    message: "",
    sanitizedSequence: sanitized,
    header: extractFastaHeader(sanitized),
  };
}

export function transformPrimerDesignParams(
  data: PrimerDesignFormData,
) {
  const params: Record<string, any> = {
    output_path: data.output_path.trim(),
    output_file: data.output_file.trim(),
    input_type: data.input_type,
  };

  if (data.PRIMER_PICK_INTERNAL_OLIGO !== undefined) {
    params.PRIMER_PICK_INTERNAL_OLIGO = data.PRIMER_PICK_INTERNAL_OLIGO;
  }

  if (data.input_type === "workplace_fasta") {
    params.sequence_input = data.sequence_input.trim();
  } else if (data.input_type === "sequence_text") {
    const sanitized = data.sequence_input
      ? sanitizePrimerDesignSequence(data.sequence_input)
      : "";
    params.sequence_input = getSequenceForSubmission(sanitized);

    if (data.SEQUENCE_ID && data.SEQUENCE_ID.trim()) {
      params.SEQUENCE_ID = data.SEQUENCE_ID.trim();
    }
  }

  const regionMappings: Array<[keyof PrimerDesignFormData, string]> = [
    ["SEQUENCE_EXCLUDED_REGION", "SEQUENCE_EXCLUDED_REGION"],
    ["SEQUENCE_TARGET", "SEQUENCE_TARGET"],
    ["SEQUENCE_INCLUDED_REGION", "SEQUENCE_INCLUDED_REGION"],
    ["SEQUENCE_OVERLAP_JUNCTION_LIST", "SEQUENCE_OVERLAP_JUNCTION_LIST"],
  ];

  regionMappings.forEach(([field, key]) => {
    const value = data[field];
    if (Array.isArray(value) && value.length > 0) {
      params[key] = value.join(" ");
    }
  });

  if (data.PRIMER_PRODUCT_SIZE_RANGE && Array.isArray(data.PRIMER_PRODUCT_SIZE_RANGE) && data.PRIMER_PRODUCT_SIZE_RANGE.length > 0) {
    params.PRIMER_PRODUCT_SIZE_RANGE = data.PRIMER_PRODUCT_SIZE_RANGE
      .join(" ")
      .replace(/,/g, "-");
  }

  if (data.PRIMER_NUM_RETURN !== undefined) {
    params.PRIMER_NUM_RETURN = data.PRIMER_NUM_RETURN;
  }

  if (data.PRIMER_MIN_SIZE !== undefined) {
    params.PRIMER_MIN_SIZE = data.PRIMER_MIN_SIZE;
  }

  if (data.PRIMER_OPT_SIZE && data.PRIMER_OPT_SIZE.trim()) {
    params.PRIMER_OPT_SIZE = data.PRIMER_OPT_SIZE.trim();
  }

  if (data.PRIMER_MAX_SIZE !== undefined) {
    params.PRIMER_MAX_SIZE = data.PRIMER_MAX_SIZE;
  }

  if (data.PRIMER_MIN_TM !== undefined) {
    params.PRIMER_MIN_TM = data.PRIMER_MIN_TM;
  }

  if (data.PRIMER_OPT_TM !== undefined) {
    params.PRIMER_OPT_TM = data.PRIMER_OPT_TM;
  }

  if (data.PRIMER_MAX_TM !== undefined) {
    params.PRIMER_MAX_TM = data.PRIMER_MAX_TM;
  }

  if (data.PRIMER_PAIR_MAX_DIFF_TM !== undefined) {
    params.PRIMER_PAIR_MAX_DIFF_TM = data.PRIMER_PAIR_MAX_DIFF_TM;
  }

  if (data.PRIMER_MIN_GC !== undefined) {
    params.PRIMER_MIN_GC = data.PRIMER_MIN_GC;
  }

  if (data.PRIMER_OPT_GC !== undefined) {
    params.PRIMER_OPT_GC = data.PRIMER_OPT_GC;
  }

  if (data.PRIMER_MAX_GC !== undefined) {
    params.PRIMER_MAX_GC = data.PRIMER_MAX_GC;
  }

  if (data.PRIMER_SALT_MONOVALENT !== undefined) {
    params.PRIMER_SALT_MONOVALENT = data.PRIMER_SALT_MONOVALENT;
  }

  if (data.PRIMER_DNA_CONC !== undefined) {
    params.PRIMER_DNA_CONC = data.PRIMER_DNA_CONC;
  }

  if (data.PRIMER_SALT_DIVALENT !== undefined) {
    params.PRIMER_SALT_DIVALENT = data.PRIMER_SALT_DIVALENT;
  }

  if (data.PRIMER_DNTP_CONC !== undefined) {
    params.PRIMER_DNTP_CONC = data.PRIMER_DNTP_CONC;
  }

  return params;
}

export function resetPrimerDesignValues(): PrimerDesignFormData {
  return { ...DEFAULT_PRIMER_DESIGN_FORM_VALUES };
}


