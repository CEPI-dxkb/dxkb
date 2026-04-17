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
