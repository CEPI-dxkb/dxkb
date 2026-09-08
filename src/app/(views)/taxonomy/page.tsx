import { Suspense } from "react";
import { parseTaxonomyCollectionState } from "@/lib/taxonomy-view";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { TaxonomyCollection } from "./taxonomy-collection";

export default async function TaxonomyCollectionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const state = parseTaxonomyCollectionState(await searchParams);
  const queryKey = JSON.stringify([state.keyword, state.rql, state.filters]);
  return (
    <Suspense fallback={<div className="p-6">Loading Taxa...</div>}>
      <TaxonomyCollection key={queryKey} initialState={state} />
    </Suspense>
  );
}
