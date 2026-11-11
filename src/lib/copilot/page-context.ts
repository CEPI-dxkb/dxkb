/**
 * Built from the URL alone (the gateway's `/get-path-state` only knows BV-BRC URLs). Never include
 * tokens or private data: the sentence is saved with the turn.
 */

const siteSentence =
  "The user is on DXKB (the Disease X Knowledge Base), a site built on BV-BRC data and services; DXKB page URLs differ from BV-BRC's.";

const entityLabels = new Map<string, string>(Object.entries({
  genome: "genome",
  feature: "feature",
  taxonomy: "taxon",
  strain: "strain",
  epitope: "epitope",
  experiment: "experiment",
}));

const collectionLabels = new Map<string, string>(Object.entries({
  genome: "genomes",
  feature: "genomic features",
  taxonomy: "taxa",
  strain: "strains",
  epitope: "epitopes",
  experiment: "experiments",
  serology: "serology records",
  surveillance: "surveillance records",
  "protein-structure": "protein structures",
  "domains-and-motifs": "protein domains and motifs",
}));

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function clip(value: string, max = 300): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function describeView(
  segments: string[],
  search: URLSearchParams,
): string | null {
  const [first, second] = segments;
  if (!first) return "the DXKB home page";

  const entity = entityLabels.get(first);
  if (entity && second) {
    const tab = search.get("tab");
    return `the page for ${entity} ${clip(decode(second), 100)}${tab ? ` (${clip(tab, 50)} tab)` : ""}`;
  }

  const collection = collectionLabels.get(first);
  if (collection) {
    const rql = search.get("rql");
    return rql
      ? `a list of ${collection} filtered by the RQL query ${clip(rql)}`
      : `the list of ${collection}`;
  }

  if (first === "organisms" && second) {
    return `the ${clip(decode(second), 100)} organism overview${segments[2] ? ` (${clip(decode(segments.slice(2).join("/")), 200)})` : ""}`;
  }

  if (first === "workspace") {
    const path = segments.slice(1).map(decode).join("/");
    return path
      ? `their workspace folder ${clip(path)}`
      : "their workspace";
  }

  if (first === "jobs") return "their list of submitted jobs";

  if (first === "services") {
    // `/services/<name>`: route groups are not in the URL.
    const name = segments[1];
    return name
      ? `the submission form for the ${clip(decode(name), 100).replace(/-/g, " ")} service`
      : "the list of analysis services";
  }

  if (first === "search") {
    const keyword = search.get("keyword") ?? search.get("q");
    return keyword ? `search results for "${clip(keyword, 200)}"` : "the search page";
  }

  return null;
}

export function describeCopilotPage(
  pathname: string,
  search: string | URLSearchParams = "",
): string {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const segments = pathname.split("/").filter(Boolean);
  const view = describeView(segments, params);
  if (!view) return siteSentence;
  // This literal cap keeps the sentence under the gateway's 2,000-character limit (server.ts is
  // server-only, so the limit is not imported).
  return `${siteSentence} They are viewing ${view} (URL path ${clip(pathname, 300)}).`.slice(
    0,
    1900,
  );
}
