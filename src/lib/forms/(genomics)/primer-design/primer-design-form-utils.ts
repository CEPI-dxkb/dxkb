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

export const primerArrayFields = [
  "PRIMER_PRODUCT_SIZE_RANGE",
  "SEQUENCE_TARGET",
  "SEQUENCE_INCLUDED_REGION",
  "SEQUENCE_EXCLUDED_REGION",
  "SEQUENCE_OVERLAP_JUNCTION_LIST",
] as const;

export const primerScalarFields = [
  "PRIMER_NUM_RETURN",
  "PRIMER_MIN_SIZE",
  "PRIMER_OPT_SIZE",
  "PRIMER_MAX_SIZE",
  "PRIMER_MIN_TM",
  "PRIMER_OPT_TM",
  "PRIMER_MAX_TM",
  "PRIMER_PAIR_MAX_DIFF_TM",
  "PRIMER_MIN_GC",
  "PRIMER_OPT_GC",
  "PRIMER_MAX_GC",
  "PRIMER_SALT_MONOVALENT",
  "PRIMER_SALT_DIVALENT",
  "PRIMER_DNA_CONC",
  "PRIMER_DNTP_CONC",
] as const;

export const primerAdvancedFields = [
  "PRIMER_NUM_RETURN",
  "PRIMER_MIN_TM",
  "PRIMER_OPT_TM",
  "PRIMER_MAX_TM",
  "PRIMER_PAIR_MAX_DIFF_TM",
  "PRIMER_MIN_GC",
  "PRIMER_OPT_GC",
  "PRIMER_MAX_GC",
  "PRIMER_SALT_MONOVALENT",
  "PRIMER_SALT_DIVALENT",
  "PRIMER_DNA_CONC",
  "PRIMER_DNTP_CONC",
] as const;

export const markerLabels = {
  exclude: "< >",
  target: "[ ]",
  include: "{ }",
} as const;

export type MarkerType = keyof typeof markerLabels | "clear";

const MARKER_REGEX = /[<>[\]{}']+/g;
// Legacy validation only allows a, g, c, t, n (not extended IUPAC codes)
const NUCLEOTIDE_REGEX = /[agctn]/gi;

function normalizeNewlines(sequence: string) {
  return sequence.replace(/\r\n?/g, "\n");
}

/**
 * Sanitizes FASTA sequence - matches legacy sanitizeFastaSequence behavior
 * Removes spaces from sequence lines, preserves headers
 */
export function sanitizePrimerDesignSequence(sequence: string): string {
  if (!sequence) {
    return "";
  }

  const normalized = normalizeNewlines(sequence);
  const lines = normalized.split("\n");
  
  // Filter header lines (starting with '>')
  const headers = lines.filter((line) => /^>.*/.test(line));
  
  // Filter non-header lines and remove spaces
  const sanitized = lines
    .filter((line) => !/^>.*/.test(line))
    .map((line) => line.replace(/ /g, ""));
  
  // Concatenate headers and sanitized sequence lines
  return headers.concat(sanitized).join("\n");
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

/**
 * Removes nucleotide characters (a, g, c, t, n) from a string
 * Used to test whether a line with '>' is a header or a sequence
 */
function removeNucleotides(val: string): string {
  const nucleotideList = ["a", "c", "t", "g", "n"];
  let result = val.toLowerCase();
  for (const nuc of nucleotideList) {
    result = result.replace(new RegExp(nuc, "gi"), "");
  }
  return result;
}

/**
 * Checks if sequence contains invalid characters
 * Matches legacy isInvalidSequence behavior:
 * - Only allows a, g, c, t, n (not extended IUPAC codes)
 * - Removes markers before checking
 * - Skips header lines (starting with '>')
 */
function isInvalidSequence(val: string): boolean {
  const splitSeq = val.toLowerCase().split("\n");
  for (const line of splitSeq) {
    const trimmed = line.trim();
    if (trimmed.charAt(0) === ">") {
      continue; // Skip header lines
    }
    // Remove valid nucleotides (a, g, c, t, n)
    let cleaned = trimmed.replace(NUCLEOTIDE_REGEX, "");
    // Remove markers
    cleaned = cleaned.replace(MARKER_REGEX, "");
    // If anything remains, it's invalid
    if (cleaned.length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if sequence has only one FASTA record
 * Matches legacy hasSingleFastaSequence behavior:
 * - Only counts headers that have non-nucleotide content (real headers)
 */
function hasSingleFastaSequence(sequence: string): boolean {
  let headerCount = 0;
  const splitSeq = sequence.toLowerCase().split("\n");
  for (const line of splitSeq) {
    if (line.charAt(0) === ">") {
      const tmpLine = removeNucleotides(line.toLowerCase());
      // Only count if it has non-nucleotide content (length > 1, since '>' is 1 char)
      if (tmpLine.length > 1) {
        headerCount += 1;
      }
      if (headerCount > 1) {
        return false;
      }
    }
  }
  return true;
}

export function validatePrimerDesignSequence(
  sequence: string,
): PrimerSequenceValidationResult {
  // Match legacy onChangeSequence validation order:
  // 1. Check if empty
  // 2. Check if invalid sequence
  // 3. Check if multiple FASTA sequences
  // 4. Otherwise valid

  if (!sequence || !sequence.trim()) {
    return {
      isValid: false,
      message: "Please provide a nucleotide sequence.",
      sanitizedSequence: "",
      header: null,
      errorCode: "empty",
    };
  }

  if (isInvalidSequence(sequence)) {
    return {
      isValid: false,
      message:
        "This looks like an invalid sequence. Please provide a valid nucleotide sequence.",
      sanitizedSequence: sanitizePrimerDesignSequence(sequence),
      header: extractFastaHeader(sequence),
      errorCode: "invalid_characters",
    };
  }

  if (!hasSingleFastaSequence(sequence)) {
    return {
      isValid: false,
      message:
        "Primer Design accepts only one sequence at a time. Please provide only one sequence.",
      sanitizedSequence: sanitizePrimerDesignSequence(sequence),
      header: extractFastaHeader(sequence),
      errorCode: "multiple_records",
    };
  }

  // All checks passed - sequence is valid
  const sanitized = sanitizePrimerDesignSequence(sequence);
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
  const params: Record<string, unknown> = {
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

  const regionMappings: [keyof PrimerDesignFormData, string][] = [
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


