import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DataApiError } from "@/lib/data-api/repository";
import { isEpitopeId, parseEpitopeTab } from "@/lib/epitope-view";
import { getEpitope } from "@/lib/epitope-view/server";
import { epitopeHref } from "@/lib/views/hrefs";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { canonicalizeMemberTabQuery } from "@/lib/views/search-params";
import { EpitopeMember } from "./epitope-member";

interface EpitopeMetadataProps {
  params: Promise<{ epitopeId: string }>;
}

interface EpitopePageProps extends EpitopeMetadataProps {
  searchParams: Promise<SearchParamsRecord>;
}

async function loadEpitope(rawEpitopeId: string) {
  let epitopeId: string;
  try {
    epitopeId = decodeURIComponent(rawEpitopeId);
  } catch {
    notFound();
  }
  if (!isEpitopeId(epitopeId)) notFound();
  try {
    const epitope = await getEpitope(epitopeId);
    if (!epitope) notFound();
    return epitope;
  } catch (error) {
    if (error instanceof DataApiError && [401, 403, 404].includes(error.status))
      notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: EpitopeMetadataProps): Promise<Metadata> {
  const { epitopeId } = await params;
  const epitope = await loadEpitope(epitopeId);
  return {
    title: `${epitope.epitope_sequence ?? epitope.epitope_id} | Epitope`,
    description: epitope.protein_name ?? `Epitope record ${epitope.epitope_id}`,
  };
}

export default async function EpitopePage({
  params,
  searchParams,
}: EpitopePageProps) {
  const [{ epitopeId }, query] = await Promise.all([params, searchParams]);
  const epitope = await loadEpitope(epitopeId);
  const activeTab = parseEpitopeTab(query.tab);
  const canonicalQuery = canonicalizeMemberTabQuery(query, activeTab);
  if (canonicalQuery !== null) {
    redirect(
      `${epitopeHref(epitope.epitope_id)}${canonicalQuery ? `?${canonicalQuery}` : ""}`,
    );
  }
  return <EpitopeMember epitope={epitope} activeTab={activeTab} />;
}
