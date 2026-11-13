import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { recordUnavailableMessage } from "@/components/errors/record-load-failure";
import { RecordUnavailable } from "@/components/errors/record-unavailable";
import { DataApiError } from "@/lib/data-api/repository";
import {
  canonicalFeatureTab,
  currentCompareRegionAvailability,
  featureDisplayName,
  isFeatureId,
  parseFeatureTab,
  settledCompareRegionAvailability,
} from "@/lib/feature-view";
import { resolveCompareRegionAvailability } from "@/lib/feature-view/compare-region-peg-server";
import { getFeature, type FeatureLookup } from "@/lib/feature-view/server";
import { loadLineageCrumbs } from "@/lib/taxonomy-view/lineage-server";
import { toQueryString } from "@/lib/url";
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

function querySuffix(query: SearchParamsRecord): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(name, item);
    }
  }
  const search = toQueryString(params);
  return search ? `?${search}` : "";
}

async function loadFeature(
  rawFeatureId: string,
  source: RouteParamSource,
  query: SearchParamsRecord,
) {
  // The two entry points receive this segment in different encodings, so each
  // declares its `source` (see `readRouteParam`).
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
    const unavailable = recordUnavailableMessage(error);
    if (unavailable === null) throw error;
    if (source === "page") console.error(`feature/${featureId}:`, error);
    return { featureId, unavailable } as const;
  }
  if (!result.feature) notFound();
  if (result.usedAlternateId && result.feature.feature_id !== featureId) {
    // Keep the query so a BRC-ID link into a tab lands on that tab.
    permanentRedirect(
      `${featureHref(result.feature.feature_id)}${querySuffix(query)}`,
    );
  }
  return { featureId, feature: result.feature } as const;
}

export async function generateMetadata({
  params,
  searchParams,
}: FeaturePageProps): Promise<Metadata> {
  const [{ featureId }, query] = await Promise.all([params, searchParams]);
  const loaded = await loadFeature(featureId, "metadata", query);
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
  const loaded = await loadFeature(featureId, "page", query);
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
  // Only the Compare Region tab needs the counterpart lookup's answer before it
  // renders (to redirect a closed tab and to feed the panel); any other tab
  // streams it to the rail, so a slow lookup holds no content.
  const lookup =
    settledCompareRegionAvailability(feature) ??
    resolveCompareRegionAvailability(feature);
  const compare =
    parseFeatureTab(query.tab) === "compare-region" ? await lookup : lookup;
  const activeTab = canonicalFeatureTab(
    query.tab,
    feature,
    currentCompareRegionAvailability(compare),
  );
  const canonicalQuery = canonicalizeMemberTabQuery(query, activeTab);
  if (canonicalQuery !== null) {
    redirect(
      `${featureHref(feature.feature_id)}${canonicalQuery ? `?${canonicalQuery}` : ""}`,
    );
  }
  return (
    <FeatureMember
      feature={feature}
      compare={compare}
      lineage={loadLineageCrumbs(String(feature.taxon_id ?? ""), `feature/${feature.feature_id}`)}
      activeTab={activeTab}
    />
  );
}
