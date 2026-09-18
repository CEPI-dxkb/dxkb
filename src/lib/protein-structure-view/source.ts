import {
  isAlphaFoldId,
  isPdbId,
  normalizeProteinStructureAccessions,
} from "./mode";

export type StructureFormat = "pdb" | "mmcif" | "bcif";
export type StructureSourceKind =
  "bv-brc" | "alphafold" | "rcsb" | "workspace" | "url";

export interface StructureSource {
  url: string;
  format: StructureFormat;
  label: string;
  kind: StructureSourceKind;
}

export interface ProteinStructureSourceInput {
  pdb_id?: string;
  file_path?: string;
  uniprotkb_accession?: string | readonly string[];
  workspacePath?: string;
}

const uniprotPattern =
  /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})$/;

function encodePath(path: string): string {
  return path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

function formatFromPath(path: string): StructureFormat {
  const normalized = path.toLowerCase().replace(/\.gz$/, "");
  if (normalized.endsWith(".bcif")) return "bcif";
  if (normalized.endsWith(".cif") || normalized.endsWith(".mmcif")) {
    return "mmcif";
  }
  return "pdb";
}

/**
 * Build the workspace-file `StructureSource` for an already-decoded workspace
 * path. This is the single place extension detection, filename extraction,
 * and per-segment URL encoding happen for workspace structure files, shared
 * by the `/protein-structure?path=` view and the standalone
 * `/viewer/structure/[[...path]]` catch-all route.
 */
export function buildWorkspaceStructureSource(path: string): StructureSource {
  const normalizedPath = path.replace(/^\/+/, "");
  return {
    url: `/api/workspace/view/${encodePath(normalizedPath)}`,
    format: formatFromPath(normalizedPath),
    label: normalizedPath.split("/").filter(Boolean).pop() ?? normalizedPath,
    kind: "workspace",
  };
}

function firstUniProtAccession(
  value: string | readonly string[] | undefined,
): string | undefined {
  const values: readonly string[] =
    typeof value === "string" ? [value] : (value ?? []);
  return values
    .flatMap((item) => item.split(","))
    .map((item) => item.trim().toUpperCase())
    .find((item) => uniprotPattern.test(item));
}

export function resolveProteinStructureSources(
  input: ProteinStructureSourceInput,
): StructureSource[] {
  const candidates: StructureSource[] = [];
  const [accession] = normalizeProteinStructureAccessions(input.pdb_id);
  const filePath = input.file_path?.trim();
  if (filePath) {
    const normalizedPath = filePath.replace(/^\/+/, "");
    const sourcePath = normalizedPath.replace(/\.gz$/i, "");
    candidates.push({
      url: `/api/structure/${encodePath(sourcePath)}`,
      format: formatFromPath(sourcePath),
      label: accession || normalizedPath.split("/").pop() || normalizedPath,
      kind: "bv-brc",
    });
  }

  const uniprotAccession = firstUniProtAccession(input.uniprotkb_accession);
  const modelId =
    accession && isAlphaFoldId(accession)
      ? accession
      : uniprotAccession
        ? `AF-${uniprotAccession}-F1`
        : undefined;
  if (modelId) {
    candidates.push({
      url: `https://alphafold.ebi.ac.uk/files/${modelId}-model_v6.cif`,
      format: "mmcif",
      label: modelId,
      kind: "alphafold",
    });
  }

  if (accession && isPdbId(accession)) {
    candidates.push({
      url: `https://files.rcsb.org/download/${accession}.cif`,
      format: "mmcif",
      label: accession,
      kind: "rcsb",
    });
  }

  if (input.workspacePath?.trim()) {
    candidates.push(buildWorkspaceStructureSource(input.workspacePath.trim()));
  }

  return candidates;
}
