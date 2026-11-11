/**
 * Transport and parsing boundary for SRA run-accession validation, free of
 * React state so the component applies one staleness guard.
 */

export interface SraValidationResult {
  runs: string[];
  title: string;
}

/**
 * Outcome of one validation request; `timeout` means the backend gave up on
 * NCBI and the accession is accepted as a single run.
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

export function toPlainText(s: string): string {
  const text = new DOMParser().parseFromString(s, "text/html").body.textContent;
  return text.trim() || s;
}

export function parseXmlAndExtract(xmlText: string): {
  title: string;
  runs: string[];
  isValid: boolean;
} {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const parseError = xmlDoc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Failed to parse XML response");
  }

  let title = "";

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
 * Validates one accession against the SRA proxy route; never throws, and an
 * abort surfaces as `error`, so callers must discard superseded outcomes.
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
