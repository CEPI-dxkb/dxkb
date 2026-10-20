import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { recordUnavailableMessage } from "@/components/errors/record-load-failure";
import { RecordUnavailable } from "@/components/errors/record-unavailable";
import { DataApiError } from "@/lib/data-api/repository";
import {
  canonicalFeatureTab,
  featureDisplayName,
  isFeatureId,
} from "@/lib/feature-view";
import { getFeature, type FeatureLookup } from "@/lib/feature-view/server";
import { featureHref } from "@/lib/views/hrefs";
import type { SearchParamsRecord } from "@/lib/views/rql";
import {
  readRouteParam,
  type RouteParamSource,
} from "@/lib/views/route-params";
import { canonicalizeMemberTabQuery } from "@/lib/views/search-params";
import { FeatureMember } from "./feature-member";

interface FeaturePageProps {
  params: Promise<{ featureId: string }>;
  searchParams: Promise<SearchParamsRecord>;
}

async function loadFeature(rawFeatureId: string, source: RouteParamSource) {
  // The two entry points receive this segment in different encodings, so
  // each declares which it is. Decoding unconditionally made
  // `generateMetadata` resolve a different record than the body for any id
  // containing a literal percent escape. See `readRouteParam`.
  const featureId = readRouteParam(rawFeatureId, source);
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
    // An outage is rendered, not thrown: production would redact its message.
    const unavailable = recordUnavailableMessage(error);
    if (unavailable === null) throw error;
    if (source === "page") console.error(`feature/${featureId}:`, error);
    return { featureId, unavailable } as const;
  }
  if (!result.feature) notFound();
  if (result.usedAlternateId && result.feature.feature_id !== featureId) {
    permanentRedirect(featureHref(result.feature.feature_id));
  }
  return { featureId, feature: result.feature } as const;
}

export async function generateMetadata({
  params,
}: FeaturePageProps): Promise<Metadata> {
  const { featureId } = await params;
  const loaded = await loadFeature(featureId, "metadata");
  if (loaded.unavailable !== undefined) return { title: `${loaded.featureId} | Feature` };
  const { feature } = loaded;
  return {
    title: `${featureDisplayName(feature)} | Feature`,
    description: feature.product ?? `Feature record ${feature.feature_id}`,
  };
}

export default async function FeaturePage({
  params,
  searchParams,
}: FeaturePageProps) {
  const [{ featureId }, query] = await Promise.all([params, searchParams]);
  const loaded = await loadFeature(featureId, "page");
  if (loaded.unavailable !== undefined) {
    return (
      <RecordUnavailable
        viewLabel="Feature View"
        recordLabel="Feature"
        recordId={loaded.featureId}
        message={loaded.unavailable}
        collectionHref="/feature"
        collectionLabel="Features"
      />
    );
  }
  const { feature } = loaded;
  const activeTab = canonicalFeatureTab(query.tab, feature);
  const canonicalQuery = canonicalizeMemberTabQuery(query, activeTab);
  if (canonicalQuery !== null) {
    redirect(
      `${featureHref(feature.feature_id)}${canonicalQuery ? `?${canonicalQuery}` : ""}`,
    );
  }
  return <FeatureMember feature={feature} activeTab={activeTab} />;
}
