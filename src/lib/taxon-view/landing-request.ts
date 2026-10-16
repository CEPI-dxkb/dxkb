import type { OrganismLandingView } from "@/components/organisms/types";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { firstSearchParam } from "@/lib/views/search-params";

type LandingTabRequest =
  | { redirectToOverview: true }
  | {
      redirectToOverview: false;
      /** The view to open: `tab`, else the legacy `view` (undefined: the default). */
      activeViewKey?: string;
      /**
       * The raw `tab` param (null: none), which the shell's tab content compares
       * with the URL. Not `activeViewKey`: a legacy `?view=genomes` link opens
       * Genomes on a URL without `tab`, and a shell told "genomes" there would
       * never match its own URL.
       */
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
