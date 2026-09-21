/**
 * Transport + parsing boundary for SRA run-accession validation.
 *
 * Everything here is free of React state so the component can apply a single
 * staleness guard to the resolved outcome instead of scattering guards across
 * every branch of the request chain.
 */

export interface SraValidationResult {
  runs: string[];
  title: string;
}

/**
 * Interpretation of one validation request.
 *
 * - `invalid-format` — the accession failed the client-side shape check and no
 *   request was made.
 * - `error` — the backend rejected the accession, or the request itself failed.
 * - `timeout` — the backend gave up on NCBI; the accession is accepted as a
 *   single run.
 * - `not-run` — the record parsed but contains no run accessions.
 * - `valid` — one or more run accessions were extracted.
 */
export type SraValidationOutcome =
  | { status: "invalid-format" }
  | { status: "error"; message: string }
  | { status: "timeout"; result: SraValidationResult }
  | { status: "not-run" }
  | { status: "valid"; result: SraValidationResult };

const accessionPattern = /^[a-z]{3}[0-9]+$/i;

export function isWellFormedAccession(accession: string): boolean {
  return accessionPattern.test(accession);
}

/** Strips HTML tags so only plain text is stored/displayed (XSS safety). */
export function toPlainText(s: string): string {
  const text = new DOMParser().parseFromString(s, "text/html").body.textContent;
  return text.trim() || s;
}

/**
 * Parses XML text and extracts data using XPath-like queries
 */
export function parseXmlAndExtract(xmlText: string): {
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

/**
 * Validates one accession against the SRA proxy route.
 *
 * Never throws: transport and parse failures come back as an `error` outcome so
 * the caller's staleness guard stays in one place. Aborting the supplied signal
 * also surfaces as `error`; callers must discard superseded outcomes rather
 * than relying on the abort to suppress them.
 */
export async function requestSraValidation(
  accession: string,
  signal?: AbortSignal,
): Promise<SraValidationOutcome> {
  if (!isWellFormedAccession(accession)) {
    return { status: "invalid-format" };
  }

  try {
    const response = await fetch(
      `/api/services/sra-validation?accession=${encodeURIComponent(accession)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      },
    );

    if (!response.ok) {
      const errorData = (await response.json()) as { error?: unknown };
      const rawError =
        errorData.error == null
          ? ""
          : typeof errorData.error === "string"
            ? errorData.error
            : JSON.stringify(errorData.error);
      return {
        status: "error",
        message: rawError
          ? toPlainText(rawError)
          : `Your input ${accession} is not valid`,
      };
    }

    const data = (await response.json()) as {
      timeout?: boolean;
      xml?: string;
    };

    if (data.timeout) {
      return {
        status: "timeout",
        result: { runs: [accession], title: "" },
      };
    }

    const { title, runs, isValid } = parseXmlAndExtract(data.xml ?? "");
    if (!isValid || runs.length === 0) {
      return { status: "not-run" };
    }
    return { status: "valid", result: { runs, title } };
  } catch (error: unknown) {
    console.error("Error validating SRA accession:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? toPlainText(error.message)
          : "Something went wrong during validation.",
    };
  }
}
