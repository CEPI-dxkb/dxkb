interface TaxonomyDoc {
  taxon_name?: unknown;
}

function extractTaxonomyDocs(data: unknown): TaxonomyDoc[] {
  if (Array.isArray(data)) return data as TaxonomyDoc[];
  if (!data || typeof data !== "object" || !("response" in data)) return [];
  const response = (data as { response?: { docs?: unknown } }).response;
  return Array.isArray(response?.docs) ? response.docs as TaxonomyDoc[] : [];
}

export async function fetchTaxonNameById(
  taxonId: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/services/taxonomy?q=taxon_id:${encodeURIComponent(taxonId)}&fl=taxon_id,taxon_name`,
    );
    const docs = extractTaxonomyDocs(await response.json());
    const name = docs[0]?.taxon_name;
    return typeof name === "string" && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

/**
 * Sets `taxonomy_id` immediately, then looks up the taxon name and sets
 * `scientific_name` when resolved. Services with extra post-resolution work
 * (e.g. deriving my_label from a prior output_file) can pass `onResolved`.
 *
 * `form` is typed loose to accept any TanStack form whose value type includes
 * the `taxonomy_id` / `scientific_name` string fields.
 */
export function applyTaxonomyIdWithLookup(
  taxonomyId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: { setFieldValue: (field: any, value: any) => void },
  onResolved?: (taxonName: string) => void,
): void {
  form.setFieldValue("taxonomy_id", taxonomyId);
  void fetchTaxonNameById(taxonomyId).then((taxonName) => {
    if (!taxonName) return;
    form.setFieldValue("scientific_name", taxonName);
    onResolved?.(taxonName);
  });
}
