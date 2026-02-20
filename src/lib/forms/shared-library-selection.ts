import { useCallback, useState, useEffect, useRef } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
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

export interface UseLibrarySelectionConfig<
  TFormValues extends FieldValues,
  LibraryItem,
  SrrItem
> {
  form: UseFormReturn<TFormValues>;
  mapLibraryToItem: (library: Library) => LibraryItem;
  mapSraLibraryToItem?: (library: Library) => SrrItem;
  fields: {
    paired: Path<TFormValues>;
    single: Path<TFormValues>;
    srr: Path<TFormValues>;
  };
  triggerFields?: Array<Path<TFormValues>>;
  normalizeLibraries?: (nextLibraries: Library[], previousLibraries: Library[]) => Library[];
}

export interface AddPairedLibraryOptions {
  read1: string | null;
  read2: string | null;
  buildLibrary: (read1: string, read2: string, id: string) => BuildLibraryResult;
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

/**
 * Find newly added SRA libraries by comparing next state against previous state.
 * Used to identify which SRA entries need sample ID assignment and trigger side effects.
 */
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

export function useLibrarySelection<
  TFormValues extends FieldValues,
  LibraryItem,
  SrrItem = string
>(config: UseLibrarySelectionConfig<TFormValues, LibraryItem, SrrItem>) {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  // Track if we need to sync to form (skip initial mount)
  const shouldSyncRef = useRef(false);
  // Store config in ref to avoid effect dependency issues
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Sync libraries to form in an effect to avoid setState during render
  useEffect(() => {
    // Skip initial mount - only sync after state updates
    if (!shouldSyncRef.current) {
      shouldSyncRef.current = true;
      return;
    }

    const currentConfig = configRef.current;
    const pairedLibs: LibraryItem[] = [];
    const singleLibs: LibraryItem[] = [];
    const srrItems: SrrItem[] = [];

    selectedLibraries.forEach((lib) => {
      if (lib.type === "paired") {
        pairedLibs.push(currentConfig.mapLibraryToItem(lib));
      } else if (lib.type === "single") {
        singleLibs.push(currentConfig.mapLibraryToItem(lib));
      } else if (lib.type === "sra") {
        if (currentConfig.mapSraLibraryToItem) {
          srrItems.push(currentConfig.mapSraLibraryToItem(lib));
        } else {
          srrItems.push(lib.id as SrrItem);
        }
      }
    });

    currentConfig.form.setValue(currentConfig.fields.paired as never, pairedLibs as never, {
      shouldValidate: false,
    });
    currentConfig.form.setValue(currentConfig.fields.single as never, singleLibs as never, {
      shouldValidate: false,
    });
    currentConfig.form.setValue(currentConfig.fields.srr as never, srrItems as never, {
      shouldValidate: false,
    });

    currentConfig.form.trigger(
      (currentConfig.triggerFields ?? [
        currentConfig.fields.paired,
        currentConfig.fields.single,
        currentConfig.fields.srr,
      ]) as never
    );
  }, [selectedLibraries]);

  const syncLibrariesToForm = useCallback(
    (libraries: Library[]) => {
      const pairedLibs: LibraryItem[] = [];
      const singleLibs: LibraryItem[] = [];
      const srrItems: SrrItem[] = [];

      libraries.forEach((lib) => {
        if (lib.type === "paired") {
          pairedLibs.push(config.mapLibraryToItem(lib));
        } else if (lib.type === "single") {
          singleLibs.push(config.mapLibraryToItem(lib));
        } else if (lib.type === "sra") {
          if (config.mapSraLibraryToItem) {
            srrItems.push(config.mapSraLibraryToItem(lib));
          } else {
            srrItems.push(lib.id as SrrItem);
          }
        }
      });

      config.form.setValue(config.fields.paired as never, pairedLibs as never, {
        shouldValidate: false,
      });
      config.form.setValue(config.fields.single as never, singleLibs as never, {
        shouldValidate: false,
      });
      config.form.setValue(config.fields.srr as never, srrItems as never, {
        shouldValidate: false,
      });

      config.form.trigger(
        (config.triggerFields ?? [
          config.fields.paired,
          config.fields.single,
          config.fields.srr,
        ]) as never
      );
    },
    [config]
  );

  const updateLibraries = useCallback(
    (nextLibraries: Library[]) => {
      setSelectedLibraries((previousLibraries) => {
        return config.normalizeLibraries
          ? config.normalizeLibraries(nextLibraries, previousLibraries)
          : nextLibraries;
      });
    },
    [config]
  );

  const addPairedLibrary = useCallback(
    (options: AddPairedLibraryOptions) => {
      if (!options.read1 || !options.read2) {
        options.onError?.(
          options.missingMessage ?? "Both read files must be selected for paired library"
        );
        return;
      }

      if (options.read1 === options.read2) {
        options.onError?.(
          options.sameFileMessage ?? "READ FILE 1 and READ FILE 2 cannot be the same"
        );
        return;
      }

      const libraryId = getPairedLibraryId(options.read1, options.read2);
      const isDuplicate = selectedLibraries.some((lib) => lib.id === libraryId);
      if (isDuplicate) {
        options.onError?.(
          options.duplicateMessage ?? "This paired library has already been added"
        );
        return;
      }

      const result = options.buildLibrary(options.read1, options.read2, libraryId);
      if (!result.library) {
        options.onError?.(result.error ?? "Unable to add paired library");
        return;
      }

      updateLibraries([...selectedLibraries, result.library]);
      options.onAfterAdd?.(result.library);
    },
    [selectedLibraries, updateLibraries]
  );

  const addSingleLibrary = useCallback(
    (options: AddSingleLibraryOptions) => {
      if (!options.read) {
        options.onError?.(options.missingMessage ?? "Read file must be selected");
        return;
      }

      const isDuplicate = selectedLibraries.some((lib) =>
        options.duplicateMatcher ? options.duplicateMatcher(lib, options.read!) : lib.id === options.read
      );
      if (isDuplicate) {
        options.onError?.(
          options.duplicateMessage ?? "This single library has already been added"
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
    [selectedLibraries, updateLibraries]
  );

  const removeLibrary = useCallback(
    (id: string) => {
      updateLibraries(selectedLibraries.filter((lib) => lib.id !== id));
    },
    [selectedLibraries, updateLibraries]
  );

  return {
    selectedLibraries,
    syncLibrariesToForm,
    setLibrariesAndSync: updateLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
  };
}
