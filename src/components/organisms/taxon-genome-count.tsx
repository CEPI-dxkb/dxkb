import { readSession } from "@/lib/auth/server/session";
import { fetchTaxonGenomeCount } from "@/lib/services/organisms/genome-count";
import { numberFormatter } from "@/lib/services/organisms/utils";

/** The "(N Genomes)" after the Taxonomy heading, streamed so a slow count never holds the page. A failed count is omitted rather than replaced by the taxonomy record's figure, which counts Deprecated genomes. */
export async function TaxonGenomeCount({ taxonId }: { taxonId: number }) {
  const session = await readSession();
  const count = await fetchTaxonGenomeCount(taxonId, {
    token: session?.token,
  }).catch((error: unknown) => {
    console.error(`taxonomy/${String(taxonId)}: genome count failed`, error);
    return null;
  });
  if (count === null || count <= 0) return null;
  return (
    <span className="text-xs text-muted-foreground">
      ({numberFormatter.format(count)} Genomes)
    </span>
  );
}
