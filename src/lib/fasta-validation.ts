export interface FastaValidationResult {
  valid: boolean;
  status: string;
  numseq: number;
  message: string;
  trimFasta: string;
}

export interface FastaValidationOptions {
  maxFastaText?: number;
  ignoreMaxFastaTextLimit?: boolean;
  replace?: boolean;
  firstName?: string;
}

const defaultOptions: Required<FastaValidationOptions> = {
  maxFastaText: 64000,
  ignoreMaxFastaTextLimit: false,
  replace: true,
  firstName: "record_1",
};

const nucleotideAlphabet = /^[ACGTURYSWKMBDHVN-]+$/i;

export function cleanFasta(fastaText: string): string {
  let newFasta = "";
  let records = fastaText.trim();

  records = records.replace(/[\r\n]/g, "\n");
  records = records.replace(/\r|\f/g, "\n");
  records = records.replace(/^\s*[\r\n]/gm, "");

  const arr = records.split("\n");
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][0] === ">") {
      newFasta += arr[i].trim();
    } else {
      newFasta += arr[i].replace(/\s/g, "");
    }
    if (i < arr.length - 1) {
      newFasta += "\n";
    }
  }

  return newFasta;
}

export function isDNA(sequenceText: string): boolean {
  const st = sequenceText.toLowerCase();
  let count = 0;
  let gaps = 0;

  for (const ch of st) {
    if (ch === "-") {
      gaps += 1;
    } else if (["a", "c", "t", "g", "n"].includes(ch)) {
      count += 1;
    }
  }

  if (sequenceText.length > 0) {
    return count / (sequenceText.length - gaps) >= 0.75;
  }

  return false;
}

export function validateFasta(
  fastaText: string,
  seqType: "aa" | "dna" = "aa",
  options: FastaValidationOptions = {},
): FastaValidationResult {
  const opts = { ...defaultOptions, ...options };

  const result: FastaValidationResult = {
    valid: false,
    status: "",
    numseq: 0,
    message: "",
    trimFasta: "",
  };

  if (!opts.ignoreMaxFastaTextLimit && fastaText.length > opts.maxFastaText) {
    result.status = "too_long";
    result.message = "The text input is too large. Save the data to a file.";
    return result;
  }

  const records = cleanFasta(fastaText);
  result.trimFasta = records;

  const cleanRecords = records.replace(/^\s*[\r\n]/gm, "");

  if (cleanRecords !== "" && cleanRecords[0] !== ">" && !opts.replace) {
    result.status = "invalid_start";
    result.message =
      'A fasta record is at least two lines and starts with ">".';
    return result;
  } else if (cleanRecords !== "" && cleanRecords[0] !== ">" && opts.replace) {
    const prefixedRecords = ">" + opts.firstName + "\n" + cleanRecords;
    result.trimFasta = prefixedRecords;
  }

  const arr = cleanRecords.split("\n");

  if (arr.length === 0 || arr[0] === "") {
    result.status = "empty";
    result.message = "";
    return result;
  }

  if (arr[0][0] !== ">" || arr.length <= 1) {
    result.status = "too_short";
    result.message =
      'A fasta record is at least two lines and starts with ">".';
    return result;
  }

  let nextseq = 0;
  let protein = false;
  let numseq = 0;

  for (let i = 0; i < arr.length; i++) {
    if (arr[i][0] === ">") {
      numseq += 1;
      nextseq += 1;
      continue;
    }

    nextseq -= 1;
    nextseq = Math.max(0, nextseq);

    if (seqType === "dna" && !nucleotideAlphabet.test(arr[i])) {
      result.status = "need_dna";
      result.message = `Invalid nucleotide letters on line ${String(i + 1)}.`;
      return result;
    }

    if (!protein && !isDNA(arr[i])) protein = true;

    if (!/^[ABCDEFGHIJKLMNOPQRSTUVWXYZ\-\n]+$/i.test(arr[i].toUpperCase())) {
      result.status = "invalid_letters";
      result.message = `The sequences must have valid letters. Check line: ${String(i + 1)}.`;
      return result;
    }
  }

  if (nextseq) {
    result.status = "missing_seqs";
    result.message =
      "There are missing sequences or extra fasta identifier lines.";
    return result;
  }

  result.valid = true;
  result.status = seqType === "dna" || !protein ? "valid_dna" : "valid_protein";
  result.numseq = numseq;
  result.message = "";

  return result;
}

export function validateProteinFasta(
  fastaText: string,
  options: FastaValidationOptions = {},
): FastaValidationResult {
  const result = validateFasta(fastaText, "aa", options);
  if (!result.valid) return result;

  const nucleotideLine = result.trimFasta
    .split("\n")
    .findIndex(
      (line) =>
        line.length > 0 &&
        !line.startsWith(">") &&
        nucleotideAlphabet.test(line),
    );
  if (nucleotideLine >= 0) {
    return {
      ...result,
      valid: false,
      status: "need_protein",
      message: `This service requires protein sequences. Nucleotide sequence found on line ${String(nucleotideLine + 1)}.`,
    };
  }

  return result;
}

export function validateFastaForBlast(
  fastaText: string,
  inputType: "blastn" | "blastp" | "blastx" | "tblastn",
): FastaValidationResult {
  let expectedSeqType: "aa" | "dna";

  switch (inputType) {
    case "blastn":
    case "blastx":
      expectedSeqType = "dna";
      break;
    case "blastp":
    case "tblastn":
      expectedSeqType = "aa";
      break;
    default:
      expectedSeqType = "aa";
  }

  return validateFasta(fastaText, expectedSeqType);
}

export function getFastaErrorMessage(
  validationResult: FastaValidationResult,
  programDisplayName: string,
): string {
  if (validationResult.status === "need_dna") {
    return `${programDisplayName} requires nucleotide sequences. ${validationResult.message}`;
  }

  return validationResult.message;
}
