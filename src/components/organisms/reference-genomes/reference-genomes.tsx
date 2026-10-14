import {
  genomeScopeFromProps,
  type GenomeScopeProps,
} from "@/components/organisms/shared/genome-scope-props";
import { fetchReferenceGenomes } from "@/lib/services/organisms/reference-genomes";

import { ReferenceGenomesClient } from "./reference-genomes-client";

export async function ReferenceGenomes(props: GenomeScopeProps) {
  const genomes = await fetchReferenceGenomes(genomeScopeFromProps(props));
  return <ReferenceGenomesClient genomes={genomes} />;
}
