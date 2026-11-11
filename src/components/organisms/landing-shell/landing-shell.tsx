import type { ReactNode } from "react";

import { LandingShellClient } from "./landing-shell-client";
import type {
  OrganismLandingConfig,
  OrganismLandingNavItem,
  OrganismLandingView,
  OrganismViewKey,
} from "@/components/organisms/types";

interface OrganismLandingShellProps {
  config: OrganismLandingConfig;
  views: readonly OrganismLandingView[];
  activeViewKey?: string;
  /** The raw `tab` search param the page was rendered for (null: none); apart from `activeViewKey` because a legacy `?view=` link opens a view without a `tab`. */
  tabParam: string | null;
  headerContent?: ReactNode;
}

function isOrganismViewKey(
  value: string | undefined,
  views: readonly OrganismLandingView[],
): value is OrganismViewKey {
  return views.some((view) => view.key === value && view.enabled !== false);
}

export function OrganismLandingShell({
  config,
  views,
  activeViewKey,
  tabParam,
  headerContent,
}: OrganismLandingShellProps) {
  const defaultView = config.defaultView ?? "overview";
  const visibleViews = config.hideDisabledTabs
    ? views.filter((view) => view.enabled !== false)
    : views;
  const requestedKey = isOrganismViewKey(activeViewKey, visibleViews) ? activeViewKey : defaultView;
  // requestedKey may point at a disabled defaultView; .at(0) types the result as
  // T | undefined for the null guard below.
  const activeView =
    visibleViews.find((view) => view.key === requestedKey && view.enabled !== false) ??
    visibleViews.find((view) => view.enabled !== false) ??
    visibleViews.at(0);
  const navItems: OrganismLandingNavItem[] = visibleViews.map(
    ({ key, label, icon, enabled, disabledReason }) => ({
      key,
      label,
      icon,
      enabled,
      disabledReason,
    }),
  );
  if (!activeView) return null;
  const ActiveViewComponent = activeView.Component;

  return (
    <LandingShellClient
      displayName={config.displayName}
      activeView={activeView.key}
      defaultView={defaultView}
      navItems={navItems}
      headerContent={headerContent}
      layout={activeView.layout ?? "scroll"}
      tabParam={tabParam}
    >
      <ActiveViewComponent />
    </LandingShellClient>
  );
}
