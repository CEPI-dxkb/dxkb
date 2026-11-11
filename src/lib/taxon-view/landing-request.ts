import type { OrganismLandingView } from "@/components/organisms/types";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { firstSearchParam } from "@/lib/views/search-params";

type LandingTabRequest =
  | { redirectToOverview: true }
  | {
      redirectToOverview: false;
      activeViewKey?: string;
      /** The raw `tab` param (null: none); a legacy `?view=` link has none, so it differs from `activeViewKey`. */
      tabParam: string | null;
    };

export function resolveLandingTab(
  params: SearchParamsRecord | undefined,
  views: readonly OrganismLandingView[],
): LandingTabRequest {
  const tab = firstSearchParam(params, "tab");
  const legacyView = firstSearchParam(params, "view");
  const tabParam = tab ?? null;
  const requested = tab || legacyView;
  if (!requested) return { tabParam, redirectToOverview: false };

  const available = views.some((view) => view.key === requested && view.enabled !== false);
  return available
    ? { activeViewKey: requested, tabParam, redirectToOverview: false }
    : { redirectToOverview: true };
}
