import type {
  GenomeQueryScope,
  GenomeScope,
} from "@/lib/services/organisms/genome-scope";

/** The genomes an overview section summarizes: a taxon's lineage or a Genome list's query. */
export type GenomeScopeProps =
  | { taxonId: number; genomeQuery?: never }
  | { genomeQuery: GenomeQueryScope; taxonId?: never };

export function genomeScopeFromProps(props: GenomeScopeProps): GenomeScope {
  return props.genomeQuery ?? props.taxonId;
}
