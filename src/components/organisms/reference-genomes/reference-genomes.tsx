import {
  genomeScopeFromProps,
  type GenomeScopeProps,
} from "@/components/organisms/shared/genome-scope-props";
import {
  genomeListValuesHref,
  type GenomeListLink,
} from "@/lib/genome-view/value-links";
import { fetchReferenceGenomes } from "@/lib/services/organisms/reference-genomes";

import { LazyReferenceGenomesClient } from "./lazy-reference-genomes-client";

export async function ReferenceGenomes({
  genomeList,
  ...props
}: GenomeScopeProps & { genomeList: GenomeListLink }) {
  const { rows, counts, total } = await fetchReferenceGenomes(
    genomeScopeFromProps(props),
  );
  // Built here so the client never imports the genome view's query code. Only
  // types with genomes: counts always holds both known types, and a link naming
  // an empty one would overwrite a Genome list's own type filter and list more
  // genomes than "View all N" promises. A zero-count tab shows no link anyway.
  const types = Object.keys(counts).filter((type) => counts[type] > 0);
  const hrefs = {
    all: genomeListValuesHref(genomeList, "reference_genome", types),
    byType: Object.fromEntries(
      types.map((type) => [
        type,
        genomeListValuesHref(genomeList, "reference_genome", [type]),
      ]),
    ),
  };
  return (
    <LazyReferenceGenomesClient
      rows={rows}
      counts={counts}
      total={total}
      hrefs={hrefs}
    />
  );
}
