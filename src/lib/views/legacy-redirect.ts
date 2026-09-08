import { legacyViewTargets } from "./view-registry";

export interface MappedPath {
  pathname: string;
  search: string;
}

/**
 * Map a legacy BV-BRC /view/* request (path + raw query string, no leading "?")
 * to the new schema. Returns null if the path is not a mappable /view/* URL.
 * Hash is intentionally NOT handled here (the server cannot read it).
 */
export function mapLegacyViewPath(pathname: string, rawSearch: string): MappedPath | null {
  const parts = pathname.split("/").filter(Boolean); // ["view", "Genome", "59201.7581"]
  if (parts.length < 2 || parts[0] !== "view") return null;

  const legacyName = parts[1];
  const target = legacyViewTargets[legacyName];
  if (!target) return null;

  const { segment } = target;
  const idParts = parts.slice(2); // remaining path segments after the view name
  const isList = target.kind === "list";

  if (isList || idParts.length === 0) {
    // List view: the legacy raw query string may be raw RQL, named params, or a mix
    // (e.g. "eq(genome_id,83332.12)&filter=%22CDS%22"). Split on & and classify each
    // segment individually so named params like filter= are not swallowed into rql=.
    if (!rawSearch && !target.defaultParams) {
      return { pathname: `/${segment}`, search: "" };
    }
    const rqlParts: string[] = [];
    const namedParts: string[] = [];
    for (const seg of rawSearch.split("&")) {
      if (!seg) continue;
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(seg)) {
        namedParts.push(seg);
      } else {
        rqlParts.push(seg);
      }
    }
    const searchParts: string[] = [];
    if (rqlParts.length > 0) {
      // TaxonList historically used the Genome lineage field name even though the
      // Taxonomy endpoint exposes the same relationship as `lineage_ids`.
      const rql = rqlParts
        .join("&")
        .replaceAll("taxon_lineage_ids", segment === "taxonomy" ? "lineage_ids" : "taxon_lineage_ids");
      searchParts.push(`rql=${encodeURIComponent(rql)}`);
    }
    const namedParams = new URLSearchParams(namedParts.join("&"));
    for (const [name, value] of Object.entries(target.defaultParams ?? {})) {
      if (!namedParams.has(name)) namedParams.set(name, value);
    }
    if (namedParams.size > 0) searchParts.push(namedParams.toString());
    return { pathname: `/${segment}`, search: searchParts.join("&") };
  }

  // Singular view: keep the id in the path, preserve named query params verbatim.
  let id: string;
  try {
    id = idParts
      .map((part) => encodeURIComponent(decodeURIComponent(part)))
      .join("%2F");
  } catch {
    return null;
  }
  const search = rawSearch ? new URLSearchParams(rawSearch).toString() : "";
  return { pathname: `/${segment}/${id}`, search };
}
