"use client";

import { useRouter } from "next/navigation";
import {
  Suspense,
  use,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useViewNavCollapsed } from "@/hooks/use-view-nav-collapsed";
import { LandingMobileNav } from "@/components/organisms/landing-shell/landing-mobile-nav";
import { LandingNav } from "@/components/organisms/landing-shell/landing-nav";
import { restoreHistoryScroll } from "@/lib/history-scroll-restoration";
import { toQueryString } from "@/lib/url";
import { deleteChildCollectionParams } from "@/lib/views/child-collection-state";
import { TabContentSearchParams } from "@/components/views/tab-content-search-params";

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
  /**
   * Tabs that replace `tabs` once they resolve, for a rail whose availability
   * needs a slow lookup. Only the tab rail suspends on them, showing `tabs`
   * meanwhile, so the header and content never wait. Must not reject.
   */
  streamedTabs?: Promise<readonly EntityViewTab<Key>[]>;
  activeTab: Key;
  defaultTab: Key;
  layout?: "scroll" | "fill";
  /**
   * Set when `activeTab` is the server page's canonical `tab` param; keeps the
   * tab's content on its own URL while Back or Forward replaces it.
   */
  serverTab?: boolean;
  children: ReactNode;
}

function toNavItems<Key extends string>(tabs: readonly EntityViewTab<Key>[]) {
  return tabs.map((tab) => ({ ...tab, icon: tab.icon ?? null }));
}

function ResolvedTabs<Key extends string>({
  tabs,
  children,
}: {
  tabs: Promise<readonly EntityViewTab<Key>[]>;
  children: (tabs: readonly EntityViewTab<Key>[]) => ReactNode;
}) {
  return children(use(tabs));
}

export function EntityViewShell<Key extends string>({
  viewLabel,
  title,
  breadcrumbs,
  headerContent,
  metadataSummary,
  metadataActions,
  tabs,
  streamedTabs,
  activeTab,
  defaultTab,
  layout = "scroll",
  serverTab = false,
  children,
}: EntityViewShellProps<Key>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticTab, setOptimisticTab] = useOptimistic(activeTab);
  const { collapsed: navCollapsed, toggle: toggleNav } = useViewNavCollapsed();
  // The streamed tabs swap the mobile rail for a new one, so the shell holds
  // the sheet's open state and a sheet opened while they load stays open.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navigate = (key: Key, shown: readonly EntityViewTab<Key>[]) => {
    const tab = shown.find((item) => item.key === key);
    if (tab?.enabled === false) return;
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    if (key !== activeTab) deleteChildCollectionParams(params);
    if (key === defaultTab) params.delete("tab");
    else params.set("tab", key);
    const query = toQueryString(params);
    const destination = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
    startTransition(() => {
      setOptimisticTab(key);
      router.push(destination);
    });
  };

  // Each rail suspends on its own; the fallback is the same rail over `tabs`.
  const rail = (render: (shown: readonly EntityViewTab<Key>[]) => ReactNode) =>
    streamedTabs ? (
      <Suspense fallback={render(tabs)}>
        <ResolvedTabs tabs={streamedTabs}>{render}</ResolvedTabs>
      </Suspense>
    ) : (
      render(tabs)
    );

  const content = serverTab ? (
    <TabContentSearchParams tab={activeTab === defaultTab ? null : activeTab}>
      {children}
    </TabContentSearchParams>
  ) : (
    children
  );

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
        {rail((shown) => (
          <LandingMobileNav
            items={toNavItems(shown)}
            activeView={optimisticTab}
            onChange={(key) => {
              navigate(key, shown);
            }}
            open={streamedTabs ? mobileNavOpen : undefined}
            onOpenChange={streamedTabs ? setMobileNavOpen : undefined}
          />
        ))}
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-row gap-3 px-2 sm:px-3 lg:px-4">
        <div className="hidden lg:block">
          {rail((shown) => (
            <LandingNav
              items={toNavItems(shown)}
              activeView={optimisticTab}
              ariaLabel="Entity views"
              collapsed={navCollapsed}
              onChange={(key) => {
                navigate(key, shown);
              }}
              onCollapseToggle={toggleNav}
            />
          ))}
        </div>
        <article
          aria-busy={isPending || undefined}
          data-pending={isPending ? "" : undefined}
          className="flex min-h-0 min-w-0 flex-1 flex-col data-pending:opacity-60 motion-safe:transition-opacity"
        >
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
                {content}
              </div>
            </section>
          ) : (
            <section
              ref={restoreHistoryScroll}
              data-testid="entity-view-scroll-region"
              aria-label={`${viewLabel} content`}
              tabIndex={0}
              className="scrollbar-themed -mr-2 min-h-0 flex-1 overflow-y-auto py-4 pr-2 pl-1 sm:-mr-3 sm:pr-3 lg:-mr-4 lg:pr-4"
            >
              {content}
            </section>
          )}
        </article>
      </div>
    </>
  );
}
