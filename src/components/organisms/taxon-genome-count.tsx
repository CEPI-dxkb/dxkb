import { readSession } from "@/lib/auth/server/session";
import { fetchTaxonGenomeCount } from "@/lib/services/organisms/genome-count";
import { numberFormatter } from "@/lib/services/organisms/utils";

/**
 * The "(N Genomes)" after the Taxonomy page's heading, streamed so a slow
 * genome count never holds the page. Signed in, it counts the user's private
 * genomes too, as legacy's header and the Genomes tab do. A failed count is
 * left out rather than replaced by the taxonomy record's figure, which counts
 * Deprecated genomes; the overview and the Genomes tab report the outage.
 */
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
