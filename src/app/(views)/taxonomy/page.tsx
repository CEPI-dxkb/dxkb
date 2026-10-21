import { Suspense } from "react";
import { parseTaxonomyCollectionState } from "@/lib/taxonomy-view";
import type { SearchParamsRecord } from "@/lib/views/rql";
import TaxonomyLoading from "./loading";
import { TaxonomyCollection } from "./taxonomy-collection";

interface TaxonomyCollectionPageProps {
  searchParams: Promise<SearchParamsRecord>;
}

export default async function TaxonomyCollectionPage({
  searchParams,
}: TaxonomyCollectionPageProps) {
  const state = parseTaxonomyCollectionState(await searchParams);
  return (
    <Suspense fallback={<TaxonomyLoading />}>
      <TaxonomyCollection initialState={state} />
    </Suspense>
  );
}
