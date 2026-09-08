import { Suspense } from "react";
import {
  parseExperimentCollectionState,
  parseExperimentCollectionTab,
} from "@/lib/experiment-view";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { ExperimentCollection } from "./experiment-collection";
import ExperimentLoading from "./loading";

export default async function ExperimentCollectionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const params = await searchParams;
  const state = parseExperimentCollectionState(params);
  const activeTab = parseExperimentCollectionTab(params.tab);
  const queryKey = JSON.stringify([state.keyword, state.rql, state.filters]);
  return (
    <Suspense fallback={<ExperimentLoading />}>
      <ExperimentCollection
        key={queryKey}
        initialState={state}
        activeTab={activeTab}
      />
    </Suspense>
  );
}
