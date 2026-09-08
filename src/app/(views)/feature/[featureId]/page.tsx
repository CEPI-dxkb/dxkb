import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { DataApiError } from "@/lib/data-api/repository";
import { canonicalFeatureTab, isFeatureId } from "@/lib/feature-view";
import { getFeature, type FeatureLookup } from "@/lib/feature-view/server";
import { featureHref } from "@/lib/views/hrefs";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { canonicalizeMemberTabQuery } from "@/lib/views/search-params";
import { FeatureMember } from "./feature-member";

interface FeaturePageProps {
  params: Promise<{ featureId: string }>;
  searchParams: Promise<SearchParamsRecord>;
}

async function loadFeature(rawFeatureId: string) {
  let featureId: string;
  try {
    featureId = decodeURIComponent(rawFeatureId);
  } catch {
    notFound();
  }
  if (!isFeatureId(featureId)) notFound();
  let result: FeatureLookup;
  try {
    result = await getFeature(featureId);
  } catch (error) {
    if (
      error instanceof DataApiError &&
      [401, 403, 404, 409].includes(error.status)
    )
      notFound();
    throw error;
  }
  if (!result.feature) notFound();
  if (result.usedAlternateId && result.feature.feature_id !== featureId) {
    permanentRedirect(featureHref(result.feature.feature_id));
  }
  return result.feature;
}

export async function generateMetadata({
  params,
}: FeaturePageProps): Promise<Metadata> {
  const { featureId } = await params;
  const feature = await loadFeature(featureId);
  return {
    title: `${feature.patric_id ?? feature.feature_id} | Feature`,
    description: feature.product ?? `Feature record ${feature.feature_id}`,
  };
}

export default async function FeaturePage({
  params,
  searchParams,
}: FeaturePageProps) {
  const [{ featureId }, query] = await Promise.all([params, searchParams]);
  const feature = await loadFeature(featureId);
  const activeTab = canonicalFeatureTab(query.tab, feature);
  const canonicalQuery = canonicalizeMemberTabQuery(query, activeTab);
  if (canonicalQuery !== null) {
    redirect(
      `${featureHref(feature.feature_id)}${canonicalQuery ? `?${canonicalQuery}` : ""}`,
    );
  }
  return <FeatureMember feature={feature} activeTab={activeTab} />;
}
