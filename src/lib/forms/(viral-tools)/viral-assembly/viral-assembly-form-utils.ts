import {
  genbankAccessions,
  moduleSchema,
  referenceTypeSchema,
  type ViralAssemblyFormData,
} from "./viral-assembly-form-schema";
import type { BuildLibraryResult } from "@/lib/forms/tanstack-library-selection";
import {
  getPairedLibraryName,
  getSingleLibraryName,
} from "@/lib/forms/tanstack-library-selection";
import type { Library } from "@/types/services";

export interface ToastLike {
  error: (message: string, opts?: { description?: string }) => void;
}

export function handleLibraryError(message: string, toast: ToastLike): void {
  if (
    message === "This paired library has already been added" ||
    message === "This single library has already been added"
  ) {
    toast.error("Duplicate library", { description: message });
    return;
  }
  toast.error(message);
}

export function getPairedLibraryBuildFn(): (
  read1: string,
  read2: string,
  id: string,
) => BuildLibraryResult {
  return (read1, read2, id) => ({
    library: {
      id,
      name: getPairedLibraryName(read1, read2),
      type: "paired",
      files: [read1, read2],
    },
  });
}

export function getSingleLibraryBuildFn(): (read: string) => BuildLibraryResult {
  return (read) => ({
    library: {
      id: read,
      name: getSingleLibraryName(read),
      type: "single",
      files: [read],
    },
  });
}

export function singleLibraryDuplicateMatcher(
  library: Library,
  read: string,
): boolean {
  return library.id === read && library.type === "single";
}

/** Legacy API accepts one input per job: first paired lib, first single lib, or first SRA. */
export function transformViralAssemblyParams(
  data: ViralAssemblyFormData,
): Record<string, unknown> {
  const params: Record<string, unknown> = { strategy: data.strategy };
  if (data.strategy === "reference_guided") {
    params.reference_type = data.reference_type;
    if (data.reference_type === "genbank") {
      // The app splits this string on commas.
      params.reference_genbank_accession = genbankAccessions(
        data.reference_genbank_accession,
      ).join(",");
    } else {
      params.reference_fasta_file = data.reference_fasta_file;
    }
  } else {
    // Legacy sends EBOLA for both Ebola options; the app has no EBOLA_NON.
    params.module = data.module === "EBOLA_NON" ? "EBOLA" : data.module;
  }
  params.output_path = data.output_path.trim();
  params.output_file = data.output_file.trim();

  if (data.input_type === "paired") {
    const firstPaired = data.paired_end_libs?.[0];
    if (firstPaired?.read1 != null && firstPaired.read2 != null) {
      params.paired_end_lib = {
        read1: firstPaired.read1,
        read2: firstPaired.read2,
      };
    }
  } else if (data.input_type === "single") {
    const firstSingle = data.single_end_libs?.[0];
    if (firstSingle?.read != null) {
      params.single_end_lib = { read: firstSingle.read };
    }
  } else {
    const firstSrr = data.srr_ids?.[0];
    if (firstSrr != null) {
      params.sra_id = firstSrr;
    }
  }

  return params;
}

type ViralAssemblyRerunValues = Partial<
  Pick<
    ViralAssemblyFormData,
    | "strategy"
    | "module"
    | "reference_type"
    | "reference_genbank_accession"
    | "reference_fasta_file"
  >
>;

/**
 * `auto` runs as IRMA; a `genome` or `auto` reference opens GenBank with no accession.
 * Unknown values keep the form's default.
 */
export function viralAssemblyRerunValues(
  data: Record<string, unknown>,
): ViralAssemblyRerunValues {
  const values: ViralAssemblyRerunValues = {};
  if (data.strategy === "reference_guided" || data.strategy === "reference-guided")
    values.strategy = "reference_guided";
  else if (data.strategy === "irma" || data.strategy === "auto")
    values.strategy = "irma";

  const irmaModule = moduleSchema.safeParse(data.module);
  if (irmaModule.success) values.module = irmaModule.data;

  if (values.strategy !== "reference_guided") return values;
  const referenceType = referenceTypeSchema.safeParse(data.reference_type);
  values.reference_type = referenceType.success ? referenceType.data : "genbank";
  if (values.reference_type === "genbank") {
    const accession = data.reference_genbank_accession;
    if (typeof accession === "string")
      values.reference_genbank_accession = accession;
    else if (Array.isArray(accession))
      values.reference_genbank_accession = accession.map(String).join(",");
  } else {
    // The app takes a list of files; this form picks one, so keep the first.
    const fasta: unknown = Array.isArray(data.reference_fasta_file)
      ? data.reference_fasta_file[0]
      : data.reference_fasta_file;
    if (typeof fasta === "string") values.reference_fasta_file = fasta;
  }
  return values;
}
