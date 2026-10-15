import { genomeRecord } from "./records";

/**
 * What the loopback mock (`src/app/api/e2e-mock/[...path]/route.ts`) answers
 * when the download gateway (`/api/data/[resource]/download`) asks the Data
 * API for a file. That request is the route handler's own, server-side, so
 * `page.route()` never sees it; these bodies are what reaches the browser as
 * the downloaded file. `e2e/tests/collection-download.spec.ts` asserts on
 * them byte for byte.
 *
 * Content types are the upstream's own (plan §1.4): Text comes back as
 * `text/plain`, FASTA as `application/octet-stream`. The gateway relabels
 * both, which is part of what the spec checks.
 */
export const e2eDownloadAcceptTypes = [
  "text/tsv",
  "text/csv",
  "application/vnd.openxmlformats",
  "application/dna+fasta",
  "application/protein+fasta",
] as const;

type E2eDownloadAccept = (typeof e2eDownloadAcceptTypes)[number];

export function isE2eDownloadAccept(value: string): value is E2eDownloadAccept {
  return (e2eDownloadAcceptTypes as readonly string[]).includes(value);
}

const upstreamContentTypes: Record<E2eDownloadAccept, string> = {
  "text/tsv": "text/plain",
  "text/csv": "text/csv",
  "application/vnd.openxmlformats": "application/vnd.openxmlformats",
  "application/dna+fasta": "application/octet-stream",
  "application/protein+fasta": "application/octet-stream",
};

/** The Genome table as Text, for any genome query or selection. */
export const genomeDownloadTsv = [
  "Genome ID\tGenome Name\tGenome Status",
  `${genomeRecord.genome_id}\t${genomeRecord.genome_name}\t${genomeRecord.genome_status}`,
  "",
].join("\n");

export const genomeDownloadCsv = [
  "Genome ID,Genome Name,Genome Status",
  `${genomeRecord.genome_id},"${genomeRecord.genome_name}",${genomeRecord.genome_status}`,
  "",
].join("\n");

/**
 * The leading bytes of a zip, which an `.xlsx` is. Not a workbook a
 * spreadsheet program would open: the specs only check that a file arrives.
 */
const xlsxPlaceholder: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x50, 0x4b, 0x03, 0x04,
]);

/** The residues of every protein FASTA record the loopback answers. */
export const e2eProteinResidues = "MNEADALDIV";

/**
 * The values of the body's first `in(<field>,(…))`, in order and decoded, or
 * `[]` when it has none. `serializeRql` percent-encodes each value (a BRC ID's
 * `|` arrives as `%7C`), and a POST body is not re-encoded on the way.
 */
export function inClauseValues(body: string): string[] {
  const match = /in\([^,()]+,\(([^)]*)\)\)/.exec(body);
  if (!match) return [];
  return match[1].split(",").map((value) => decodeURIComponent(value));
}

/**
 * One FASTA record per id the request names, in the request's order, so a
 * spec can see the selection travel through the gateway into the file.
 */
function fastaFor(body: string, residues: string): string {
  return inClauseValues(body)
    .map((id) => `>${id}\n${residues}\n`)
    .join("");
}

/** The upstream file for `core` in `accept`, or `null` when none is registered. */
export function e2eDownloadFixture(
  core: string,
  accept: E2eDownloadAccept,
  body: string,
): { contentType: string; body: string | Uint8Array<ArrayBuffer> } | null {
  const contentType = upstreamContentTypes[accept];
  if (core === "genome") {
    if (accept === "text/tsv") return { contentType, body: genomeDownloadTsv };
    if (accept === "text/csv") return { contentType, body: genomeDownloadCsv };
    if (accept === "application/vnd.openxmlformats")
      return { contentType, body: xlsxPlaceholder };
    return null;
  }
  if (core === "genome_feature") {
    if (accept === "application/protein+fasta")
      return { contentType, body: fastaFor(body, e2eProteinResidues) };
    if (accept === "application/dna+fasta")
      return { contentType, body: fastaFor(body, "ATGAACGAAGCA") };
    return null;
  }
  // A genome's contigs (`sequenceDownloads.genome.via`).
  if (core === "genome_sequence" && accept === "application/dna+fasta")
    return { contentType, body: fastaFor(body, "ACGTACGTACGT") };
  return null;
}
