import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DataApiError } from "@/lib/data-api/repository";
import { isExperimentId, parseExperimentTab } from "@/lib/experiment-view";
import { getExperiment } from "@/lib/experiment-view/server";
import { experimentHref } from "@/lib/views/hrefs";
import { canonicalizeMemberTabQuery } from "@/lib/views/search-params";
import {
  readRouteParam,
  type RouteParamSource,
} from "@/lib/views/route-params";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { ExperimentMember } from "./experiment-member";

interface ExperimentMetadataProps {
  params: Promise<{ experimentId: string }>;
}

interface ExperimentPageProps extends ExperimentMetadataProps {
  searchParams: Promise<SearchParamsRecord>;
}

async function loadExperiment(
  rawExperimentId: string,
  source: RouteParamSource,
) {
  // The two entry points receive this segment in different encodings, so
  // each declares which it is. Unlike the feature and epitope views, this
  // route never had the underlying bug: `isExperimentId` accepts digits only,
  // so no experiment id can carry a percent escape for the two encodings to
  // differ on. Declaring `source` here is uniformity with the other member
  // views — one way to read a route param — not a fix for a live defect. See
  // `readRouteParam`.
  const experimentId = readRouteParam(rawExperimentId, source);
  if (!isExperimentId(experimentId)) notFound();
  try {
    const experiment = await getExperiment(experimentId);
    if (!experiment) notFound();
    return experiment;
  } catch (error) {
    if (error instanceof DataApiError && [401, 403, 404].includes(error.status))
      notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: ExperimentMetadataProps): Promise<Metadata> {
  const { experimentId } = await params;
  const experiment = await loadExperiment(experimentId, "metadata");
  return {
    title: `${experiment.exp_title ?? experiment.exp_name ?? experiment.exp_id} | Experiment`,
    description:
      experiment.exp_description ?? `Experiment record ${experiment.exp_id}`,
  };
}

export default async function ExperimentPage({
  params,
  searchParams,
}: ExperimentPageProps) {
  const [{ experimentId }, query] = await Promise.all([params, searchParams]);
  const experiment = await loadExperiment(experimentId, "page");
  const activeTab = parseExperimentTab(query.tab);
  const canonicalQuery = canonicalizeMemberTabQuery(query, activeTab);
  if (canonicalQuery !== null) {
    redirect(
      `${experimentHref(experiment.exp_id)}${canonicalQuery ? `?${canonicalQuery}` : ""}`,
    );
  }
  return <ExperimentMember experiment={experiment} activeTab={activeTab} />;
}
