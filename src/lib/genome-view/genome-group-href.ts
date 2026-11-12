import { maxRqlInValues, serializeInClause } from "@/lib/data-api/rql";
import { toQueryString } from "@/lib/url";

export type GenomeGroupHrefResult =
  | { ok: true; href: string }
  | { ok: false; message: string };

/**
 * The Genome list's Overview tab scoped to a genome group's members, the
 * React counterpart of BV-BRC's `/view/GenomeGroup/<path>`. The list's RQL
 * takes explicit ids only (no `GenomeGroup(path)`), capped at
 * `maxRqlInValues`, so an empty or oversized group is a message instead.
 */
export function genomeGroupHref(
  genomeIds: readonly string[],
): GenomeGroupHrefResult {
  const ids = [...new Set(genomeIds.filter((id) => id.trim() !== ""))];
  if (ids.length === 0) {
    return { ok: false, message: "This genome group has no genomes." };
  }
  if (ids.length > maxRqlInValues) {
    return {
      ok: false,
      message: `This genome group has ${ids.length.toLocaleString()} genomes; the genome view can show up to ${maxRqlInValues.toLocaleString()}.`,
    };
  }
  const params = new URLSearchParams();
  params.set("rql", serializeInClause("genome", "genome_id", ids));
  params.set("tab", "overview");
  return { ok: true, href: `/genome?${toQueryString(params)}` };
}
