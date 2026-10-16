import { Suspense } from "react";
import { GenomeCollection } from "./genome-collection";
import { GenomeListOverview } from "./genome-list-overview";
import GenomeLoading from "./loading";
import {
  genomeOverviewScope,
  parseGenomeCollectionState,
} from "@/lib/genome-view";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { firstSearchParam } from "@/lib/views/search-params";

interface GenomeCollectionPageProps {
  searchParams: Promise<SearchParamsRecord>;
}

export default async function GenomeCollectionPage({
  searchParams,
}: GenomeCollectionPageProps) {
  const params = await searchParams;
  const state = parseGenomeCollectionState(params);
  const queryKey = JSON.stringify([state.keyword, state.rql, state.filters]);
  // Server-rendered, and only for the Overview tab, so no other tab's paging or
  // sorting refetches the overview's charts.
  const overviewScope = genomeOverviewScope(state);
  const overview =
    firstSearchParam(params, "tab") === "overview" && overviewScope ? (
      <GenomeListOverview genomeQuery={overviewScope} state={state} />
    ) : undefined;
  return (
    <Suspense fallback={<GenomeLoading />}>
      <GenomeCollection
        key={queryKey}
        initialState={state}
        overview={overview}
      />
    </Suspense>
  );
}
