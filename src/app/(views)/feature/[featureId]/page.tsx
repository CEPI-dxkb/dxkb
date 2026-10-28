import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { recordUnavailableMessage } from "@/components/errors/record-load-failure";
import { RecordUnavailable } from "@/components/errors/record-unavailable";
import { DataApiError } from "@/lib/data-api/repository";
import {
  canonicalFeatureTab,
  featureDisplayName,
  featureLineageCrumbs,
  isFeatureId,
  type FeatureViewRecord,
  type LineageCrumb,
} from "@/lib/feature-view";
import { getFeature, type FeatureLookup } from "@/lib/feature-view/server";
import { isTaxonId } from "@/lib/taxonomy-view";
import { getTaxonomy } from "@/lib/taxonomy-view/server";
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

/** `?…` for the query the request carried, or "" for none. */
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
    // Keep the query: a BRC-ID link into a tab (the Compare Region Viewer's
    // "Compare regions around this gene") must land on that tab.
    permanentRedirect(
      `${featureHref(result.feature.feature_id)}${querySuffix(query)}`,
    );
  }
  return { featureId, feature: result.feature } as const;
}

/**
 * The taxa that lead the breadcrumb. The feature record names only its taxon,
 * so its lineage is the taxonomy record's, as BV-BRC's Feature View reads it.
 * The record itself has loaded by now, so a failed lookup costs the breadcrumb
 * its taxa, not the page. The page passes this on unawaited and the breadcrumb
 * streams it in, so a stalled lookup does not hold the record behind the
 * loading screen for the Data API's whole budget either.
 */
async function loadLineage(
  feature: FeatureViewRecord,
): Promise<LineageCrumb[]> {
  const taxonId = String(feature.taxon_id ?? "");
  if (!isTaxonId(taxonId)) return [];
  try {
    const taxon = await getTaxonomy(taxonId);
    return taxon ? featureLineageCrumbs(taxon) : [];
  } catch (error) {
    console.error(
      `feature/${feature.feature_id}: taxonomy/${taxonId} lookup failed`,
      error,
    );
    return [];
  }
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
  const activeTab = canonicalFeatureTab(query.tab, feature);
  const canonicalQuery = canonicalizeMemberTabQuery(query, activeTab);
  if (canonicalQuery !== null) {
    redirect(
      `${featureHref(feature.feature_id)}${canonicalQuery ? `?${canonicalQuery}` : ""}`,
    );
  }
  return (
    <FeatureMember
      feature={feature}
      lineage={loadLineage(feature)}
      activeTab={activeTab}
    />
  );
}
