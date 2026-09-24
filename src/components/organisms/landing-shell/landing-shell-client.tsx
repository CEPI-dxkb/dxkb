"use client";

import { useHotkey } from "@tanstack/react-hotkeys";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useState, type ReactNode } from "react";
import {
  toSearchParamsRecord,
  unionCollectionManagedParamNames,
} from "@/lib/views/collection-state";

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
  /**
   * "scroll": content region scrolls vertically (default, doc-style views).
   * "fill": content region is a bounded non-scrolling flex box the view fills
   * (table views own their own scroll).
   */
  layout?: "scroll" | "fill";
  children: ReactNode;
}

export function LandingShellClient({
  displayName,
  activeView: serverActiveView,
  defaultView,
  navItems,
  headerContent,
  layout = "scroll",
  children,
}: LandingShellClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navCollapsed, setNavCollapsed] = useState(false);

  useHotkey("Mod+B", () => {
    startTransition(() => {
      setNavCollapsed((current) => !current);
    });
  });

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
    }
    if (nextView === defaultView) {
      params.delete("tab");
    } else {
      params.set("tab", nextView);
    }
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <>
      {/* Mobile nav — fixed-position pill, lives outside the flex row so it doesn't contribute a phantom gap-3 gutter. */}
      <div className="lg:hidden">
        <LandingMobileNav
          items={navItems}
          activeView={serverActiveView}
          onChange={handleViewChange}
        />
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-row gap-3 px-2 sm:px-3 lg:px-4">
        {/* Desktop rail — hidden below lg, where the mobile nav takes over. */}
        <div className="hidden lg:block">
          <LandingNav
            items={navItems}
            activeView={serverActiveView}
            collapsed={navCollapsed}
            onChange={handleViewChange}
            onCollapseToggle={() => {
              startTransition(() => {
                setNavCollapsed((current) => !current);
              });
            }}
          />
        </div>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
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
            // Bounded, non-scrolling region: the view fills it exactly and owns
            // its own internal scroll (e.g. a virtualized table). No page scroll,
            // so no forced overflow-x and no inset page scrollbar. The negative
            // right margin cancels the outer row's px-* so the table (and its
            // right-flush action strip) reach the viewport edge — no right gutter.
            <div className="-mr-2 flex min-h-0 flex-1 overflow-hidden sm:-mr-3 lg:-mr-4">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {children}
              </div>
            </div>
          ) : (
            // Doc-style scroll region. The negative right margin cancels the outer
            // row's px-* so the scrollbar rides on the true viewport edge, while the
            // matching right padding (pr-2/3/4 == the outer px) insets the content
            // back to the header card's right edge. The thin themed scrollbar (6px)
            // is narrower than that padding, so it sits in the padding gutter and
            // the cards line up with the header instead of the viewport edge.
            // pl-1/py-4 keep the left/top/bottom borders + shadows off the clip box
            // edge (overflow-y:auto forces overflow-x:auto).
            <div
              data-testid="landing-scroll-region"
              className="scrollbar-themed -mr-2 min-h-0 flex-1 overflow-y-auto py-4 pr-2 pl-1 sm:-mr-3 sm:pr-3 lg:-mr-4 lg:pr-4"
            >
              {children}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
