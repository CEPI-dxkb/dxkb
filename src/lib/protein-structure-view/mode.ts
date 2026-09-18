import type { SearchParamsRecord } from "@/lib/views/rql";

export const maxProteinStructureAccessions = 10;

export type ProteinStructureMode =
  | { kind: "collection" }
  | { kind: "accession"; accessions: string[] }
  | { kind: "path"; path: string }
  | { kind: "invalid"; reason: string };

const pdbIdPattern = /^[0-9][A-Z0-9]{3}$/;
const alphaFoldIdPattern = /^AF-[A-Z0-9]+-F[1-9]\d*$/;

function values(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

export function isPdbId(value: string): boolean {
  return pdbIdPattern.test(value.trim().toUpperCase());
}

export function isAlphaFoldId(value: string): boolean {
  return alphaFoldIdPattern.test(value.trim().toUpperCase());
}

export function isProteinStructureAccession(value: string): boolean {
  return isPdbId(value) || isAlphaFoldId(value);
}

function normalizedAccessions(value: string | string[] | undefined): string[] {
  const normalized = values(value).flatMap((item) =>
    item.split(",").map((accession) => accession.trim().toUpperCase()),
  );
  return [...new Set(normalized.filter(Boolean))];
}

export function normalizeProteinStructureAccessions(
  value: string | string[] | undefined,
): string[] {
  return normalizedAccessions(value).slice(0, maxProteinStructureAccessions);
}

export function canonicalProteinStructureQuery(
  params: SearchParamsRecord,
  mode: Extract<ProteinStructureMode, { kind: "accession" | "path" }>,
): string | undefined {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "accession" || key === "path" || value === undefined) continue;
    for (const item of values(value)) query.append(key, item);
  }
  query.set(
    mode.kind === "accession" ? "accession" : "path",
    mode.kind === "accession" ? mode.accessions.join(",") : mode.path,
  );

  const rawDiscriminator =
    mode.kind === "accession" ? values(params.accession) : values(params.path);
  const canonicalDiscriminator =
    mode.kind === "accession" ? mode.accessions.join(",") : mode.path;
  return rawDiscriminator.length === 1 &&
    rawDiscriminator[0] === canonicalDiscriminator
    ? undefined
    : `/protein-structure?${query.toString()}`;
}

/**
 * Validate an already-decoded workspace path (Next's `searchParams` decode
 * query values once, before this ever runs — see `decoded params` note on
 * `parseProteinStructureMode`). Do not decode here: a literal `%2F` in a
 * filename would otherwise be turned into a real `/`, splitting one segment
 * into two and resolving a different file than the one named.
 */
function workspacePathError(path: string): string | undefined {
  if (!path.startsWith("/")) return "Workspace path must be absolute.";
  if (path.length > 1024) return "Workspace path is too long.";
  if (path.includes("\0") || path.split("/").includes("..")) {
    return "Workspace path contains an invalid segment.";
  }
  if (!/\.(?:pdb|cif|mmcif|bcif)$/i.test(path)) {
    return "Workspace path must identify an uncompressed PDB, CIF, mmCIF, or BCIF structure file.";
  }
  return undefined;
}

/**
 * `params` values come from a page's `searchParams` prop. Unlike a dynamic
 * route param, `searchParams` are decoded consistently at every entry point,
 * so treat every value here as the final decoded string — do not decode
 * again, or a literal `%25`/`%2F` in an accession or workspace path becomes a
 * different character than the one the user typed.
 *
 * A page component's `params` are the opposite case and DO need decoding —
 * see `readRouteParam` in `src/lib/views/route-params.ts`.
 */
export function parseProteinStructureMode(
  params: SearchParamsRecord,
): ProteinStructureMode {
  const normalized = normalizedAccessions(params.accession);
  const accessions = normalized.slice(0, maxProteinStructureAccessions);
  const paths = values(params.path)
    .map((path) => path.trim())
    .filter(Boolean);

  if (accessions.length > 0 && paths.length > 0) {
    return {
      kind: "invalid",
      reason:
        "Protein structure accession and workspace path are mutually exclusive.",
    };
  }
  if (paths.length > 1) {
    return {
      kind: "invalid",
      reason: "Only one workspace path may be viewed.",
    };
  }
  if (normalized.length > maxProteinStructureAccessions) {
    return {
      kind: "invalid",
      reason: "At most 10 protein structure accessions may be viewed.",
    };
  }
  if (accessions.length > 0) {
    const invalid = accessions.find(
      (accession) => !isProteinStructureAccession(accession),
    );
    return invalid
      ? {
          kind: "invalid",
          reason: `Invalid protein structure accession: ${invalid}`,
        }
      : { kind: "accession", accessions };
  }
  if (paths.length === 1) {
    const path = paths[0];
    const error = workspacePathError(path);
    if (error) {
      return { kind: "invalid", reason: error };
    }
    return { kind: "path", path };
  }
  return { kind: "collection" };
}
