import { ErrorPanel } from "@/components/errors/error-panel";
import { RefreshRetryButton } from "@/components/errors/retry-button";
import { OrganismLandingShell } from "@/components/organisms/landing-shell/landing-shell";
import { TaxonBreadcrumb } from "@/components/organisms/taxon-breadcrumb";
import type { OrganismLandingView } from "@/components/organisms/types";
import { viewIcons } from "@/components/views/view-icons";

import { buildTaxonomyConfig } from "./_config";

interface TaxonUnavailableProps {
  taxonId: number;
  /** The raw `tab` param, so the shell stays on the requested URL. */
  tab: string | undefined;
  message: string;
}

function makeUnavailableView(title: string, message: string) {
  return function TaxonUnavailableView() {
    return (
      <ErrorPanel
        headingLevel="h2"
        title={title}
        message={message}
        retry={<RefreshRetryButton />}
        backHref="/taxonomy"
        backLabel="Browse taxa"
      />
    );
  };
}

/**
 * A taxon page whose taxonomy lookup failed for a reason other than "not
 * found". The tabs depend on the taxon's lineage, so only Overview is offered;
 * the shell, header and rail stay, and the cause is rendered here because a
 * thrown server error reaches the boundary with its message redacted.
 */
export function TaxonUnavailable({ taxonId, tab, message }: TaxonUnavailableProps) {
  const config = buildTaxonomyConfig(taxonId, null);
  const views: OrganismLandingView[] = [
    {
      key: "overview",
      label: "Overview",
      icon: viewIcons.overview,
      Component: makeUnavailableView(
        `${config.displayName} could not be loaded`,
        message,
      ),
    },
  ];

  return (
    <OrganismLandingShell
      config={config}
      views={views}
      activeViewKey="overview"
      tabParam={tab ?? null}
      headerContent={
        <TaxonBreadcrumb taxon={null} displayName={config.displayName} />
      }
    />
  );
}
