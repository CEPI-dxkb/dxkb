"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useViewNavCollapsed } from "@/hooks/use-view-nav-collapsed";
import { LandingMobileNav } from "@/components/organisms/landing-shell/landing-mobile-nav";
import { LandingNav } from "@/components/organisms/landing-shell/landing-nav";
import { toQueryString } from "@/lib/url";
import { deleteChildCollectionParams } from "@/lib/views/child-collection-state";

export interface EntityViewTab<Key extends string = string> {
  key: Key;
  label: string;
  icon?: ReactNode;
  enabled?: boolean;
  disabledReason?: string;
}

export interface EntityViewShellProps<Key extends string = string> {
  viewLabel: string;
  title: string;
  breadcrumbs?: ReactNode;
  headerContent?: ReactNode;
  metadataSummary?: ReactNode;
  metadataActions?: ReactNode;
  tabs: readonly EntityViewTab<Key>[];
  activeTab: Key;
  defaultTab: Key;
  layout?: "scroll" | "fill";
  children: ReactNode;
}

export function EntityViewShell<Key extends string>({
  viewLabel,
  title,
  breadcrumbs,
  headerContent,
  metadataSummary,
  metadataActions,
  tabs,
  activeTab,
  defaultTab,
  layout = "scroll",
  children,
}: EntityViewShellProps<Key>) {
  const router = useRouter();
  const { collapsed: navCollapsed, toggle: toggleNav } = useViewNavCollapsed();
  const navItems = tabs.map((tab) => ({ ...tab, icon: tab.icon ?? null }));

  const navigate = (key: Key) => {
    const tab = tabs.find((item) => item.key === key);
    if (tab?.enabled === false) return;
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    // A page number or sort from one tab's table must not land on another's.
    if (key !== activeTab) deleteChildCollectionParams(params);
    if (key === defaultTab) params.delete("tab");
    else params.set("tab", key);
    const query = toQueryString(params);
    router.push(`${url.pathname}${query ? `?${query}` : ""}${url.hash}`);
  };

  const header = (
    <div className="min-w-0">
      <p className="text-xs/normal font-bold tracking-widest text-foreground uppercase">
        {viewLabel}
      </p>
      {breadcrumbs ?? (
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      )}
      {headerContent && (
        <div className="mt-1 text-sm text-muted-foreground">
          {headerContent}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="lg:hidden">
        <LandingMobileNav
          items={navItems}
          activeView={activeTab}
          onChange={navigate}
        />
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-row gap-3 px-2 sm:px-3 lg:px-4">
        <div className="hidden lg:block">
          <LandingNav
            items={navItems}
            activeView={activeTab}
            ariaLabel="Entity views"
            collapsed={navCollapsed}
            onChange={navigate}
            onCollapseToggle={toggleNav}
          />
        </div>
        <article className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="mb-0.5 flex items-center justify-between gap-4 rounded-lg border bg-card px-5 py-3 shadow-sm">
            {header}
            {metadataActions && (
              <div className="flex flex-wrap gap-2">{metadataActions}</div>
            )}
          </header>
          {metadataSummary}
          {layout === "fill" ? (
            <section
              data-testid="entity-view-fill-region"
              className="-mr-2 flex min-h-0 flex-1 overflow-hidden sm:-mr-3 lg:-mr-4"
            >
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {children}
              </div>
            </section>
          ) : (
            <section
              data-testid="entity-view-scroll-region"
              aria-label={`${viewLabel} content`}
              tabIndex={0}
              className="scrollbar-themed -mr-2 min-h-0 flex-1 overflow-y-auto py-4 pr-2 pl-1 sm:-mr-3 sm:pr-3 lg:-mr-4 lg:pr-4"
            >
              {children}
            </section>
          )}
        </article>
      </div>
    </>
  );
}
