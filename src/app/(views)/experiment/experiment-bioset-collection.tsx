"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourceChildCollection } from "@/components/views";
import { DataRepository } from "@/lib/data-api";
import {
  experimentBiosetCollectionRql,
  experimentCollectionScopeRql,
} from "@/lib/experiment-view";
import type { CollectionState } from "@/lib/views/collection-state";

const repository = new DataRepository();
const maxScopedExperiments = 500;

interface ExperimentBiosetCollectionProps {
  experimentState: CollectionState;
}

export function ExperimentBiosetCollection({
  experimentState,
}: ExperimentBiosetCollectionProps) {
  const experimentRql = experimentCollectionScopeRql(experimentState);
  const keyword = experimentState.keyword?.trim() || undefined;
  const hasExperimentScope = Boolean(experimentRql || keyword);
  const experimentIds = useQuery({
    queryKey: ["experiment", "bioset-scope", experimentRql, keyword],
    queryFn: ({ signal }) =>
      repository.export(
        "experiment",
        {
          rql: experimentRql,
          keyword,
          fields: ["exp_id"],
          limit: maxScopedExperiments + 1,
        },
        signal,
      ),
    enabled: hasExperimentScope,
  });

  if (experimentIds.isPending && hasExperimentScope) {
    return (
      <Skeleton className="m-4 min-h-96 flex-1" aria-label="Loading Biosets" />
    );
  }
  if (experimentIds.error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Unable to load Biosets</AlertTitle>
        <AlertDescription>{experimentIds.error.message}</AlertDescription>
      </Alert>
    );
  }

  const ids = experimentIds.data?.rows.map((row) => String(row.exp_id)) ?? [];
  if (ids.length > maxScopedExperiments) {
    return (
      <Alert className="m-4">
        <AlertTitle>Refine the Experiment search</AlertTitle>
        <AlertDescription>
          Biosets can be shown for up to {maxScopedExperiments} matching
          Experiments. Add a keyword or filter to narrow the results.
        </AlertDescription>
      </Alert>
    );
  }
  if (hasExperimentScope && ids.length === 0) {
    return (
      <Alert className="m-4">
        <AlertTitle>No Biosets found</AlertTitle>
        <AlertDescription>
          No Biosets match the current Experiment search.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <ResourceChildCollection
      resource="bioset"
      label="Biosets"
      idField="bioset_id"
      rql={
        hasExperimentScope
          ? experimentBiosetCollectionRql(ids)
          : "eq(bioset_id,*)"
      }
      defaultSort="bioset_id:asc"
    />
  );
}
