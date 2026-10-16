import { safeFileNameBase } from "./file-name";
import type { DataResource } from "./types";

/**
 * The FASTA download contract every call site shares: which resources serve
 * sequences, in which flavours, and how the downloaded file is named. Browser-
 * safe and dependency-free, so the hook, the gateway route and the server
 * repository all read the same table.
 *
 * Adding a FASTA-capable resource is one entry in {@link fastaResources}; the
 * route at `/api/data/[resource]/fasta`, `DataRepository.fasta()` and
 * `useFastaDownload()` take it from there.
 */
export const fastaSequenceTypes = ["dna", "protein"] as const;
export type FastaSequenceType = (typeof fastaSequenceTypes)[number];

/**
 * Sequence types the BV-BRC Data API serves for each resource, through
 * `Accept: application/dna+fasta` / `application/protein+fasta`. A
 * `genome_sequence` is a contig, so it has no protein translation.
 */
export const fastaResources = {
  genome_feature: ["dna", "protein"],
  genome_sequence: ["dna"],
} as const satisfies Partial<Record<DataResource, readonly FastaSequenceType[]>>;

export type FastaResource = keyof typeof fastaResources;

/** The sequence types {@link fastaResources} allows for one resource. */
export type FastaTypeFor<Resource extends FastaResource> =
  (typeof fastaResources)[Resource][number];

export function isFastaResource(value: string): value is FastaResource {
  return Object.hasOwn(fastaResources, value);
}

export function supportsFastaType(
  resource: FastaResource,
  type: FastaSequenceType,
): boolean {
  return (fastaResources[resource] as readonly FastaSequenceType[]).includes(
    type,
  );
}

/**
 * Ids per gateway request. The upstream rejects an `in(...)` clause with more
 * than this many values (`maxRqlInValues` in `./rql.ts`, which this module
 * does not import so it stays out of the client bundle; a test keeps the two
 * equal). `DataRepository.fasta()` splits a longer list into requests of this
 * size, so callers never have to.
 */
export const maxFastaIds = 500;

export const fastaAcceptTypes: Record<FastaSequenceType, string> = {
  dna: "application/dna+fasta",
  protein: "application/protein+fasta",
};

/** Content type of a FASTA response from the gateway and of the saved file. */
export const fastaContentType = "text/x-fasta";

export const fastaTypeLabels: Record<FastaSequenceType, string> = {
  dna: "DNA",
  protein: "Protein",
};

export interface FastaRequest {
  type: FastaSequenceType;
  ids: string[];
}

/**
 * `<base>.<type>.fasta`, with the base made safe by `safeFileNameBase`.
 */
export function fastaFileName(base: string, type: FastaSequenceType): string {
  return `${safeFileNameBase(base) || "sequences"}.${type}.fasta`;
}
