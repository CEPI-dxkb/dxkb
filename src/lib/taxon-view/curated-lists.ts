/** Curated cohort lists for taxon-view tab gating; placeholders pending the authoritative source. */
export interface CuratedLists {
  sfvtTaxonIds: ReadonlySet<number>;
  surveillanceLineageNames: ReadonlySet<string>;
  serologyLineageNames: ReadonlySet<string>;
}

const surveillanceSerologyNames: readonly string[] = [
  "Alphainfluenzavirus influenzae",
  "Rhinovirus A",
];

// Placeholder until the authoritative SFVT curation list is wired in.
const sfvtTaxonIds: readonly number[] = [
  12637, // Dengue virus
  10244, // Monkeypox virus
  2955291, // Alphainfluenzavirus influenzae
];

const defaultLists: CuratedLists = {
  sfvtTaxonIds: new Set(sfvtTaxonIds),
  surveillanceLineageNames: new Set(surveillanceSerologyNames),
  serologyLineageNames: new Set(surveillanceSerologyNames),
};

// Array.isArray rejects a wrong-typed env value (e.g. "12637", which `new Set` would split into characters).
function mergedSet<T>(
  value: readonly T[] | undefined,
  fallback: ReadonlySet<T>,
): ReadonlySet<T> {
  return new Set<T>(Array.isArray(value) ? value : fallback);
}

// Optional TAXON_VIEW_POLICY_JSON override; omitted keys keep their defaults, and malformed JSON logs and falls back wholesale.
function parseEnvPolicy(): CuratedLists | null {
  const raw = process.env.TAXON_VIEW_POLICY_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      sfvtTaxonIds?: unknown[];
      surveillanceLineageNames?: string[];
      serologyLineageNames?: string[];
    };
    return {
      sfvtTaxonIds: mergedSet(
        // Guard before .map: a non-array value would throw and discard all valid sibling overrides.
        Array.isArray(parsed.sfvtTaxonIds)
          ? parsed.sfvtTaxonIds.flatMap((value) => {
              const taxonId = Number(value);
              return isNaN(taxonId) ? [] : [taxonId];
            })
          : undefined,
        defaultLists.sfvtTaxonIds,
      ),
      surveillanceLineageNames: mergedSet(
        parsed.surveillanceLineageNames,
        defaultLists.surveillanceLineageNames,
      ),
      serologyLineageNames: mergedSet(
        parsed.serologyLineageNames,
        defaultLists.serologyLineageNames,
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `taxon-view: TAXON_VIEW_POLICY_JSON is not valid JSON (${message}); using defaults`,
    );
    return null;
  }
}

// Reads env per call so vi.resetModules() works in tests.
export function getCuratedLists(): CuratedLists {
  return parseEnvPolicy() ?? defaultLists;
}
