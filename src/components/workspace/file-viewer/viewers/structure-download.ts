import { summarizeUpstreamBody } from "@/lib/api/upstream-failure";
import type {
  StructureSource,
  StructureSourceKind,
} from "@/lib/protein-structure-view/source";

/**
 * Where each kind of structure source keeps its files, mid-sentence ("from
 * your workspace", "in the AlphaFold database"). Empty for an arbitrary URL.
 */
const structureSourcePlaces: Record<StructureSourceKind, string> = {
  "bv-brc": "BV-BRC",
  alphafold: "the AlphaFold database",
  rcsb: "the RCSB PDB",
  workspace: "your workspace",
  url: "",
};

function place(source: StructureSource, preposition: "from" | "in"): string {
  const name = structureSourcePlaces[source.kind];
  return name ? ` ${preposition} ${name}` : "";
}

/**
 * The error for a structure file that did not download. A 404 reads as "not
 * found", since an accession with no model is not an outage. Anything else
 * keeps what the server said (the app's routes answer `{error}`; an upstream
 * error page is reduced to its title) and the status.
 */
export async function structureDownloadError(
  response: Response,
  source: StructureSource,
): Promise<Error> {
  if (response.status === 404) {
    return new Error(
      `${source.label} was not found${place(source, "in")} (HTTP 404).`,
    );
  }
  const body = await response.text().catch(() => "");
  const detail = (
    summarizeUpstreamBody(body, response.headers.get("content-type")) ||
    response.statusText.trim()
  ).replace(/\.$/, "");
  return new Error(
    `Could not download ${source.label}${place(source, "from")}${detail ? `: ${detail}` : ""} (HTTP ${String(response.status)}).`,
  );
}

/**
 * Downloads a structure file for Mol*: the text of a PDB/mmCIF file, the
 * bytes of a BinaryCIF one.
 *
 * Mol*'s own `builders.data.download` does not reject on an HTTP error: it
 * leaves a failed state cell, and parsing that cell then throws Mol*'s
 * internal "Invalid data cell.", so the real cause (a workspace outage, a
 * missing AlphaFold model) never reached the user. Fetching here first lets a
 * failed download say what failed.
 */
export async function downloadStructure(
  source: StructureSource,
  signal: AbortSignal,
): Promise<string | Uint8Array<ArrayBuffer>> {
  let response: Response;
  try {
    response = await fetch(source.url, { signal });
  } catch (error) {
    if (signal.aborted) throw error;
    const reason =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "the request failed";
    throw new Error(
      `Could not download ${source.label}${place(source, "from")}: ${reason}`,
      { cause: error },
    );
  }
  if (!response.ok) throw await structureDownloadError(response, source);
  return source.format === "bcif"
    ? new Uint8Array(await response.arrayBuffer())
    : response.text();
}
