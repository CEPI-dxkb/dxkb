import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DataApiError } from "@/lib/data-api/repository";
import { canonicalGenomeTab, isGenomeId } from "@/lib/genome-view";
import { getGenome } from "@/lib/genome-view/server";
import { genomeHref } from "@/lib/views/hrefs";
import type { SearchParamsRecord } from "@/lib/views/rql";
import {
  readRouteParam,
  type RouteParamSource,
} from "@/lib/views/route-params";
import { canonicalizeMemberTabQuery } from "@/lib/views/search-params";
import { GenomeMember } from "./genome-member";

interface GenomePageProps {
  params: Promise<{ genomeId: string }>;
  searchParams: Promise<SearchParamsRecord>;
}

async function loadGenome(rawGenomeId: string, source: RouteParamSource) {
  // The two entry points receive this segment in different encodings, so
  // each declares which it is. Unlike the feature and epitope views, this
  // route never had the underlying bug: `isGenomeId` is `/^\d+\.\d+$/`, so no
  // genome id can carry a percent escape for the two encodings to differ on.
  // Declaring `source` here is uniformity with the other member views — one
  // way to read a route param — not a fix for a live defect. See
  // `readRouteParam`.
  const genomeId = readRouteParam(rawGenomeId, source);
  if (!isGenomeId(genomeId)) notFound();
  try {
    const genome = await getGenome(genomeId);
    if (!genome) notFound();
    return genome;
  } catch (error) {
    if (
      error instanceof DataApiError &&
      (error.status === 401 || error.status === 403 || error.status === 404)
    ) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: GenomePageProps): Promise<Metadata> {
  const { genomeId } = await params;
  const genome = await loadGenome(genomeId, "metadata");
  return {
    title: `${genome.genome_name ?? genome.genome_id} | Genome`,
    description: `Genome record ${genome.genome_id}`,
  };
}

export default async function GenomePage({
  params,
  searchParams,
}: GenomePageProps) {
  const [{ genomeId }, query] = await Promise.all([params, searchParams]);
  const genome = await loadGenome(genomeId, "page");
  const activeTab = canonicalGenomeTab(query.tab, genome);
  const canonicalQuery = canonicalizeMemberTabQuery(query, activeTab);
  if (canonicalQuery !== null) {
    redirect(
      `${genomeHref(genome.genome_id)}${canonicalQuery ? `?${canonicalQuery}` : ""}`,
    );
  }
  return <GenomeMember genome={genome} activeTab={activeTab} />;
}
