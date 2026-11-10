import { genomeRecord } from "./records";

/**
 * Bodies the loopback mock answers when the download gateway asks the Data API for a file; `page.route()` never sees that server-side request.
 * Content types are the upstream's own (Text as `text/plain`, FASTA as `application/octet-stream`); the gateway relabels both.
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

/** The leading bytes of a zip (what an `.xlsx` is); not a real workbook, specs only check that a file arrives. */
const xlsxPlaceholder: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x50, 0x4b, 0x03, 0x04,
]);

export const e2eProteinResidues = "MNEADALDIV";

/** `serializeRql` percent-encodes each value (a BRC ID's `|` arrives as `%7C`), and a POST body is not re-encoded. */
export function inClauseValues(body: string): string[] {
  const match = /in\([^,()]+,\(([^)]*)\)\)/.exec(body);
  if (!match) return [];
  return match[1].split(",").map((value) => decodeURIComponent(value));
}

function fastaFor(body: string, residues: string): string {
  return inClauseValues(body)
    .map((id) => `>${id}\n${residues}\n`)
    .join("");
}

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
  if (core === "genome_sequence" && accept === "application/dna+fasta")
    return { contentType, body: fastaFor(body, "ACGTACGTACGT") };
  return null;
}
