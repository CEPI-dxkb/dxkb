import { safeFileNameBase } from "./file-name";
import type { DataResource } from "./types";

/**
 * The FASTA contract shared by the hook, the gateway route and the server
 * repository. Browser-safe and dependency-free.
 */
export const fastaSequenceTypes = ["dna", "protein"] as const;
export type FastaSequenceType = (typeof fastaSequenceTypes)[number];

/** A `genome_sequence` is a contig, so it has no protein translation. */
export const fastaResources = {
  genome_feature: ["dna", "protein"],
  genome_sequence: ["dna"],
} as const satisfies Partial<Record<DataResource, readonly FastaSequenceType[]>>;

export type FastaResource = keyof typeof fastaResources;

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
 * Does not import `maxRqlInValues`, to stay out of the client bundle; a test
 * keeps the two equal.
 */
export const maxFastaIds = 500;

export const fastaAcceptTypes: Record<FastaSequenceType, string> = {
  dna: "application/dna+fasta",
  protein: "application/protein+fasta",
};

export const fastaContentType = "text/x-fasta";

export const fastaTypeLabels: Record<FastaSequenceType, string> = {
  dna: "DNA",
  protein: "Protein",
};

export interface FastaRequest {
  type: FastaSequenceType;
  ids: string[];
}

export function fastaFileName(base: string, type: FastaSequenceType): string {
  return `${safeFileNameBase(base) || "sequences"}.${type}.fasta`;
}
