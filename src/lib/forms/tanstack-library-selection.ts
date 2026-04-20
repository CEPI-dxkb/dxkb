import { useCallback, useState, useEffect, useRef } from "react";
import type { AnyFormApi } from "@tanstack/react-form";
import type { Library } from "@/types/services";

export interface BaseLibraryItem {
  _id: string;
  _type: "paired" | "single" | "srr_accession";
  read?: string;
  read1?: string;
  read2?: string;
}

export interface BuildLibraryResult {
  library?: Library;
  error?: string;
}

export interface AddPairedLibraryOptions {
  read1: string | null;
  read2: string | null;
  buildLibrary: (
    read1: string,
    read2: string,
    id: string,
  ) => BuildLibraryResult;
  onError?: (message: string) => void;
  onAfterAdd?: (library: Library) => void;
  missingMessage?: string;
  sameFileMessage?: string;
  duplicateMessage?: string;
}

export interface AddSingleLibraryOptions {
  read: string | null;
  buildLibrary: (read: string) => BuildLibraryResult;
  onError?: (message: string) => void;
  onAfterAdd?: (library: Library) => void;
  missingMessage?: string;
  duplicateMessage?: string;
  duplicateMatcher?: (library: Library, read: string) => boolean;
}

export function buildBaseLibraryItem(library: Library): BaseLibraryItem {
  const baseLib: BaseLibraryItem = {
    _id: library.id,
    _type:
      library.type === "paired"
        ? "paired"
        : library.type === "single"
          ? "single"
          : "srr_accession",
  };

  if (library.type === "paired" && library.files) {
    baseLib.read1 = library.files[0];
    baseLib.read2 = library.files[1];
  } else if (library.type === "single" && library.files) {
    baseLib.read = library.files[0];
  }

  return baseLib;
}

export function getPairedLibraryId(read1: string, read2: string): string {
  return `${read1}${read2}`;
}

export function getPairedLibraryName(read1: string, read2: string): string {
  return `P(${read1.split("/").pop()}, ${read2.split("/").pop()})`;
}

export function getSingleLibraryName(read: string): string {
  return `S(${read.split("/").pop()})`;
}

export function findNewSraLibraries(
  nextLibs: Library[],
  prevLibs: Library[],
): Library[] {
  const prevSraIds = new Set(
    prevLibs.filter((lib) => lib.type === "sra").map((lib) => lib.id),
  );
  return nextLibs.filter(
    (lib) => lib.type === "sra" && !prevSraIds.has(lib.id),
  );
}

export interface UseTanstackLibrarySelectionConfig<LibraryItem, SrrItem> {
  form: AnyFormApi;
  mapLibraryToItem: (library: Library) => LibraryItem;
  mapSraLibraryToItem?: (library: Library) => SrrItem;
  fields: {
    paired: string;
    single: string;
    srr: string;
  };
  normalizeLibraries?: (
    nextLibraries: Library[],
    previousLibraries: Library[],
  ) => Library[];
}

export function useTanstackLibrarySelection<LibraryItem, SrrItem = string>(
  config: UseTanstackLibrarySelectionConfig<LibraryItem, SrrItem>,
) {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const selectedLibrariesRef = useRef<Library[]>([]);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const applyLibrariesToForm = useCallback(
    (
      libraries: Library[],
      cfg: UseTanstackLibrarySelectionConfig<LibraryItem, SrrItem>,
    ) => {
      const pairedLibs: LibraryItem[] = [];
      const singleLibs: LibraryItem[] = [];
      const srrItems: SrrItem[] = [];

      libraries.forEach((lib) => {
        if (lib.type === "paired") {
          pairedLibs.push(cfg.mapLibraryToItem(lib));
        } else if (lib.type === "single") {
          singleLibs.push(cfg.mapLibraryToItem(lib));
        } else if (lib.type === "sra") {
          if (cfg.mapSraLibraryToItem) {
            srrItems.push(cfg.mapSraLibraryToItem(lib));
          } else {
            srrItems.push(lib.id as SrrItem);
          }
        }
      });

      cfg.form.setFieldValue(cfg.fields.paired, pairedLibs);
      cfg.form.setFieldValue(cfg.fields.single, singleLibs);
      cfg.form.setFieldValue(cfg.fields.srr, srrItems);
    },
    [],
  );

  const updateLibraries = useCallback(
    (nextLibraries: Library[]) => {
      const cfg = configRef.current;
      const finalLibraries = cfg.normalizeLibraries
        ? cfg.normalizeLibraries(nextLibraries, selectedLibrariesRef.current)
        : nextLibraries;
      selectedLibrariesRef.current = finalLibraries;
      setSelectedLibraries(finalLibraries);
      applyLibrariesToForm(finalLibraries, cfg);
    },
    [applyLibrariesToForm],
  );

  const addPairedLibrary = useCallback(
    (options: AddPairedLibraryOptions) => {
      if (!options.read1 || !options.read2) {
        options.onError?.(
          options.missingMessage ??
            "Both read files must be selected for paired library",
        );
        return;
      }

      if (options.read1 === options.read2) {
        options.onError?.(
          options.sameFileMessage ??
            "READ FILE 1 and READ FILE 2 cannot be the same",
        );
        return;
      }

      const libraryId = getPairedLibraryId(options.read1, options.read2);
      const isDuplicate = selectedLibraries.some((lib) => lib.id === libraryId);
      if (isDuplicate) {
        options.onError?.(
          options.duplicateMessage ??
            "This paired library has already been added",
        );
        return;
      }

      const result = options.buildLibrary(
        options.read1,
        options.read2,
        libraryId,
      );
      if (!result.library) {
        options.onError?.(result.error ?? "Unable to add paired library");
        return;
      }

      updateLibraries([...selectedLibraries, result.library]);
      options.onAfterAdd?.(result.library);
    },
    [selectedLibraries, updateLibraries],
  );

  const addSingleLibrary = useCallback(
    (options: AddSingleLibraryOptions) => {
      if (!options.read) {
        options.onError?.(
          options.missingMessage ?? "Read file must be selected",
        );
        return;
      }

      const isDuplicate = selectedLibraries.some((lib) =>
        options.duplicateMatcher
          ? options.duplicateMatcher(lib, options.read as string)
          : lib.id === options.read,
      );
      if (isDuplicate) {
        options.onError?.(
          options.duplicateMessage ??
            "This single library has already been added",
        );
        return;
      }

      const result = options.buildLibrary(options.read);
      if (!result.library) {
        options.onError?.(result.error ?? "Unable to add single library");
        return;
      }

      updateLibraries([...selectedLibraries, result.library]);
      options.onAfterAdd?.(result.library);
    },
    [selectedLibraries, updateLibraries],
  );

  const removeLibrary = useCallback(
    (id: string) => {
      updateLibraries(selectedLibraries.filter((lib) => lib.id !== id));
    },
    [selectedLibraries, updateLibraries],
  );

  return {
    selectedLibraries,
    setLibraries: updateLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
  };
}
