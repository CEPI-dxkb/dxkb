import { summarizeUpstreamBody } from "@/lib/api/upstream-failure";
import type {
  StructureSource,
  StructureSourceKind,
} from "@/lib/protein-structure-view/source";

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
 * Mol*'s builders.data.download does not reject on an HTTP error and later throws
 * "Invalid data cell.", hiding the real cause; fetching first lets a failed download
 * say what failed.
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
  let bytes = new Uint8Array(await response.arrayBuffer());
  if (isGzip(bytes)) bytes = await gunzip(bytes, source);
  return source.format === "bcif" ? bytes : new TextDecoder().decode(bytes);
}

function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * The magic bytes decide, not the name, so a body the browser already inflated is not
 * inflated twice.
 */
async function gunzip(
  bytes: Uint8Array<ArrayBuffer>,
  source: StructureSource,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const inflated = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }).pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(inflated).arrayBuffer());
  } catch (error) {
    const reason =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "the gzip data is not valid";
    throw new Error(`Could not decompress ${source.label}: ${reason}`, {
      cause: error,
    });
  }
}
