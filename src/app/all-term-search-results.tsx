"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

import { normalizeLegacyKeyword } from "@/app/search/legacy-keyword-normalization";
import Footer from "@/components/footers/footer";
import { LandingMobileNav } from "@/components/organisms/landing-shell/landing-mobile-nav";
import { LandingNav } from "@/components/organisms/landing-shell/landing-nav";
import { LandingNavSkeleton } from "@/components/organisms/landing-shell/landing-nav-skeleton";
import { SearchResultsHeader } from "@/components/search/all-types/search-results-header";
import { moveResultFocus } from "@/components/search/all-types/result-focus";
import { searchTypeIcon } from "@/components/search/all-types/search-type-icon";
import { TypeResultsCard } from "@/components/search/all-types/type-results-card";
import {
  sectionAnchorId,
  useSectionNav,
} from "@/components/search/all-types/use-section-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { useViewNavCollapsed } from "@/hooks/use-view-nav-collapsed";
import { useAuth } from "@/lib/auth/provider";
import {
  allTypesSearchQueryOptions,
  formatCompact,
  formatCount,
  toAllTypesResults,
} from "@/lib/search/all-types-search";
import { cn, formatUserFacingErrorMessage } from "@/lib/utils";

const genericSearchErrorMessage =
  "The search could not be completed. Please try again.";

/**
 * A concave corner in the page color that rounds a card's cut under the pinned
 * header; it reaches 4 units past the card edge to cover its side shadow.
 */
function HeaderFillet({ side }: { side: "left" | "right" }) {
  const corner = "M-4 0H10A10 10 0 0 0 0 10H-4Z";
  return (
    <svg
      aria-hidden
      viewBox="0 0 10 10"
      className={cn(
        "pointer-events-none absolute top-full size-(--radius) overflow-visible",
        side === "left" ? "left-2" : "right-2 -scale-x-100",
      )}
    >
      <path d={corner} className="fill-background" />
      <path d={corner} className="fill-muted/30" />
    </svg>
  );
}

interface SearchResultsProps {
  query: string;
  /** With `false` the header scrolls away; the Data types rail stays pinned either way. */
  pinnedHeader?: boolean;
}

export function SearchResults({
  query,
  pinnedHeader = true,
}: SearchResultsProps) {
  const keyword = normalizeLegacyKeyword(query);
  const { user } = useAuth();
  const search = useQuery(
    allTypesSearchQueryOptions(keyword, user?.id ?? "anonymous"),
  );
  const { data, isFetching } = search;
  const { error, retrying, retry } = useRetryKeepingError(search, keyword);
  // Any read in flight while an error shows is a retry: the error stays.
  const busy = retrying || (Boolean(error) && isFetching);
  const isLoading = search.isLoading && !error;
  const { types, total, bestMatch } = toAllTypesResults(data, keyword);
  const found = types.filter((type) => type.count > 0);
  const ready = !isLoading && !error;

  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { collapsed, toggle } = useViewNavCollapsed();
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [scrolled, setScrolled] = useState(false);
  const nav = useSectionNav({
    ref: scrollRef,
    topInset: pinnedHeader ? headerRef : undefined,
    offset: pinnedHeader ? 0 : 16,
    ids: ready ? found.map((type) => type.id) : [],
  });

  const setOpen = (id: string, open: boolean) => {
    const next = new Set(closed);
    if (open) next.delete(id);
    else next.add(id);
    setClosed(next);
  };

  const select = (id: string) => {
    if (!closed.has(id)) {
      nav.select(id);
      return;
    }
    setOpen(id, true);
    requestAnimationFrame(() => {
      nav.select(id);
    });
  };

  const allClosed = found.length > 0 && found.every((type) => closed.has(type.id));

  const navItems = types.map((type) => ({
    key: type.id,
    label: type.label,
    icon: searchTypeIcon(type.id),
    count: formatCompact(type.count),
    enabled: type.count > 0,
    disabledReason: type.count > 0 ? undefined : "No matches",
  }));

  const mobileNav =
    ready && found.length > 0 ? (
      <div className="lg:hidden">
        <LandingMobileNav
          items={navItems}
          activeView={nav.active ?? ""}
          title="Data types"
          onChange={select}
        />
      </div>
    ) : null;

  const rail = isLoading ? (
    <div className="hidden pt-4 lg:block">
      <LandingNavSkeleton />
    </div>
  ) : error ? null : (
    <div className="hidden pt-4 lg:block">
      <LandingNav
        items={navItems}
        activeView={nav.active ?? ""}
        ariaLabel="Data types"
        title="Data types"
        toggleLabel="data type navigation"
        collapsed={collapsed}
        onChange={select}
        onCollapseToggle={toggle}
      />
    </div>
  );

  const header = (
    <SearchResultsHeader
      keyword={keyword}
      summary={
        isLoading
          ? "Searching every DXKB data type…"
          : error
            ? busy
              ? "Retrying the search…"
              : "Search unavailable"
            : found.length === 0
              ? "No records in any DXKB data type"
              : `${formatCount(total)} records across ${String(found.length)} data type${found.length === 1 ? "" : "s"}`
      }
      bestMatch={ready ? bestMatch : null}
      raised={pinnedHeader && scrolled}
      actions={
        ready && found.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setClosed(
                allClosed ? new Set() : new Set(found.map((type) => type.id)),
              );
            }}
          >
            {allClosed ? <ChevronsUpDown /> : <ChevronsDownUp />}
            {allClosed ? "Expand all" : "Collapse all"}
          </Button>
        ) : null
      }
    />
  );

  const results = isLoading ? (
    Array.from({ length: 3 }, (_, index) => (
      <Skeleton key={index} className="h-64 w-full rounded-lg" />
    ))
  ) : error ? (
    <Alert variant="destructive" aria-busy={busy || undefined}>
      <AlertTitle>Search results could not be loaded</AlertTitle>
      <AlertDescription>
        <p>{formatUserFacingErrorMessage(error, genericSearchErrorMessage)}</p>
        <QueryRetryButton retrying={busy} onRetry={retry} />
      </AlertDescription>
    </Alert>
  ) : found.length === 0 ? (
    <Card variant="raised" className="px-6 py-12">
      <div className="text-center">
        <h2 className="text-lg font-semibold">No results found</h2>
        <p className="text-sm text-muted-foreground">
          No DXKB data type matches &ldquo;{keyword}&rdquo;. Try different
          search terms.
        </p>
      </div>
    </Card>
  ) : (
    found.map((type) => (
      // Outlined on an inner overlay: an outline on the target itself would
      // paint under the table's positioned scroll area and header fill.
      <div
        key={type.id}
        id={sectionAnchorId(type.id)}
        className="relative rounded-lg after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:outline-2 after:-outline-offset-2 after:outline-transparent after:transition-colors after:duration-500 data-flash:after:outline-secondary"
      >
        <TypeResultsCard
          type={type}
          open={!closed.has(type.id)}
          onOpenChange={(open) => {
            setOpen(type.id, open);
          }}
        />
      </div>
    ))
  );

  // Rendered here, not passed in by the server page: a server-rendered element
  // prop made React DevTools log a "children should not have changed" warning
  // on every load.
  const footer = <Footer />;

  // `relative` keeps the footer's absolutely positioned parts inside the scroll
  // area, or they stretch the page past the viewport.
  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        setScrolled(event.currentTarget.scrollTop > 0);
      }}
      className="scrollbar-themed relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/30"
    >
      {mobileNav}
      <div className="flex w-full flex-1 gap-3 px-2 pb-8 sm:px-3 lg:px-4">
        {rail}
        <div className="min-w-0 flex-1">
          {/* Opaque in the page's own color so results scroll out of sight under
              it; 8px wider than the column per side to cover shadows. */}
          <div
            ref={headerRef}
            className={cn(
              pinnedHeader && "sticky top-0 z-10 -mx-2 bg-background",
            )}
          >
            <div
              className={cn("pt-4 pb-1.5", pinnedHeader && "bg-muted/30 px-2")}
            >
              {header}
            </div>
            {pinnedHeader && scrolled ? (
              <>
                <HeaderFillet side="left" />
                <HeaderFillet side="right" />
              </>
            ) : null}
          </div>
          <div className="mt-1.5 space-y-3" onKeyDown={moveResultFocus}>
            {results}
          </div>
        </div>
      </div>
      {footer}
    </div>
  );
}
