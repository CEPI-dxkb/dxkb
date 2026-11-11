"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";
import { useViewNavCollapsed } from "@/hooks/use-view-nav-collapsed";
import { restoreHistoryScroll } from "@/lib/history-scroll-restoration";
import { deleteChildCollectionParams } from "@/lib/views/child-collection-state";
import {
  toSearchParamsRecord,
  unionCollectionManagedParamNames,
} from "@/lib/views/collection-state";
import { toQueryString } from "@/lib/url";
import { TabContentSearchParams } from "@/components/views/tab-content-search-params";

import { LandingNav } from "./landing-nav";
import { LandingMobileNav } from "./landing-mobile-nav";
import { organismTabCollectionOptions } from "./organism-tab-collection-options";
import type {
  OrganismLandingNavItem,
  OrganismViewKey,
} from "@/components/organisms/types";

interface LandingShellClientProps {
  displayName: string;
  activeView: OrganismViewKey;
  defaultView: OrganismViewKey;
  navItems: readonly OrganismLandingNavItem[];
  headerContent?: ReactNode;
  /** "scroll": the region scrolls (doc-style); "fill": a bounded box the view fills (table views own their scroll). */
  layout?: "scroll" | "fill";
  /** The `tab` search param the server rendered for (null: none); keeps the active view on its URL while Back/Forward replaces it. */
  tabParam?: string | null;
  children: ReactNode;
}

export function LandingShellClient({
  displayName,
  activeView: serverActiveView,
  defaultView,
  navItems,
  headerContent,
  layout = "scroll",
  tabParam,
  children,
}: LandingShellClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticView, setOptimisticView] = useOptimistic(serverActiveView);
  const { collapsed: navCollapsed, toggle: toggleNav } = useViewNavCollapsed();

  function handleViewChange(nextView: OrganismViewKey) {
    const target = navItems.find((item) => item.key === nextView);
    if (target?.enabled === false) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    if (nextView !== serverActiveView) {
      const current = toSearchParamsRecord(params);
      for (const name of unionCollectionManagedParamNames(
        current,
        organismTabCollectionOptions,
      )) {
        params.delete(name);
      }
      deleteChildCollectionParams(params);
    }
    if (nextView === defaultView) {
      params.delete("tab");
    } else {
      params.set("tab", nextView);
    }
    const queryString = toQueryString(params);
    const destination = queryString ? `${pathname}?${queryString}` : pathname;
    startTransition(() => {
      setOptimisticView(nextView);
      router.push(destination);
    });
  }

  const content =
    tabParam === undefined ? (
      children
    ) : (
      <TabContentSearchParams tab={tabParam}>{children}</TabContentSearchParams>
    );

  return (
    <>
      <div className="lg:hidden">
        <LandingMobileNav
          items={navItems}
          activeView={optimisticView}
          onChange={handleViewChange}
        />
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-row gap-3 px-2 sm:px-3 lg:px-4">
        <div className="hidden lg:block">
          <LandingNav
            items={navItems}
            activeView={optimisticView}
            collapsed={navCollapsed}
            onChange={handleViewChange}
            onCollapseToggle={toggleNav}
          />
        </div>
        <section
          aria-busy={isPending || undefined}
          data-pending={isPending ? "" : undefined}
          className="flex min-h-0 min-w-0 flex-1 flex-col data-pending:opacity-60 motion-safe:transition-opacity"
        >
          <div className="mb-0.5 flex items-center justify-between rounded-lg border bg-card px-5 py-3 shadow-sm">
            {headerContent ?? (
              <div>
                <p className="text-3xs font-bold tracking-widest text-muted-foreground uppercase">
                  Organisms
                </p>
                <h1 className="text-2xl font-bold tracking-tight">
                  {displayName}
                </h1>
              </div>
            )}
          </div>
          {layout === "fill" ? (
            // Bounded non-scrolling region; the negative right margin cancels the outer
            // row's px-* so the table reaches the viewport edge.
            <div className="-mr-2 flex min-h-0 flex-1 overflow-hidden sm:-mr-3 lg:-mr-4">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {content}
              </div>
            </div>
          ) : (
            // Doc-style scroll region. The negative right margin cancels the outer px-* so
            // the scrollbar rides the viewport edge; the matching right padding insets the
            // content back to the header card. pl-1/py-4 keep borders and shadows off the
            // clip edge.
            <div
              ref={restoreHistoryScroll}
              data-testid="landing-scroll-region"
              className="scrollbar-themed -mr-2 min-h-0 flex-1 overflow-y-auto py-4 pr-2 pl-1 sm:-mr-3 sm:pr-3 lg:-mr-4 lg:pr-4"
            >
              {content}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
