"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourceChildCollection } from "@/components/views/resource-child-collection";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { DataRepository } from "@/lib/data-api";
import { keywordQuery } from "@/lib/data-api/keyword-terms";
import {
  experimentBiosetCollectionRql,
  experimentCollectionScopeRql,
} from "@/lib/experiment-view";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import type { CollectionState } from "@/lib/views/collection-state";

const repository = new DataRepository();
const defaultMaxScopedExperiments = 500;
const unscopedExperimentState: CollectionState = {
  filters: {},
  page: 1,
  sort: "exp_id:asc",
};
const genericScopeErrorMessage =
  "The matching experiments could not be loaded. Please try again.";

interface ExperimentBiosetCollectionProps {
  /** The Experiment search (filters, keyword, rql) whose experiments scope the Biosets. */
  experimentState?: CollectionState;
  /**
   * An experiment predicate always applied, such as a taxon lineage clause. Bioset
   * records carry no taxon or genome fields (their `organism` is the host), so a
   * taxon reaches its Biosets only through its experiments' `exp_id`s.
   */
  baseRql?: string;
  /** The most matching experiments whose Biosets are listed before asking to refine. */
  maxExperiments?: number;
}

export function ExperimentBiosetCollection({
  experimentState = unscopedExperimentState,
  baseRql,
  maxExperiments = defaultMaxScopedExperiments,
}: ExperimentBiosetCollectionProps) {
  const searchRql = experimentCollectionScopeRql(experimentState);
  const experimentRql =
    baseRql && searchRql ? `and(${baseRql},${searchRql})` : baseRql ?? searchRql;
  const keyword =
    keywordQuery(experimentState.keyword ?? "").length > 0
      ? experimentState.keyword?.trim()
      : undefined;
  const hasExperimentScope = Boolean(experimentRql || keyword);
  const experimentIds = useQuery({
    queryKey: ["experiment", "bioset-scope", experimentRql, keyword],
    queryFn: ({ signal }) =>
      repository.export(
        "experiment",
        {
          rql: experimentRql,
          keyword,
          keywordMode: "exact",
          fields: ["exp_id"],
          limit: maxExperiments + 1,
        },
        signal,
      ),
    enabled: hasExperimentScope,
  });
  const scopeRetry = useRetryKeepingError(
    experimentIds,
    JSON.stringify([experimentRql, keyword]),
  );

  // An Alert is `w-full`, so a horizontal margin would push it past the content
  // edge; use padding.
  if (scopeRetry.error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTitle>Could not load biosets</AlertTitle>
          <AlertDescription>
            <p>
              {formatUserFacingErrorMessage(
                scopeRetry.error,
                genericScopeErrorMessage,
              )}
            </p>
            <QueryRetryButton
              retrying={scopeRetry.retrying}
              onRetry={scopeRetry.retry}
            />
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  if (experimentIds.isPending && hasExperimentScope) {
    return (
      <Skeleton
        className="m-4 min-h-96 flex-1"
        role="status"
        aria-label="Loading Biosets"
      />
    );
  }

  const ids = experimentIds.data?.rows.map((row) => String(row.exp_id)) ?? [];
  if (ids.length > maxExperiments) {
    return (
      <div className="p-4">
        <Alert>
          <AlertTitle>Refine the Experiment search</AlertTitle>
          <AlertDescription>
            Biosets can be shown for up to {maxExperiments} matching
            Experiments. Add a keyword or filter to narrow the results.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  if (hasExperimentScope && ids.length === 0) {
    return (
      <div className="p-4">
        <Alert>
          <AlertTitle>No Biosets found</AlertTitle>
          <AlertDescription>
            No Biosets match the current Experiment search.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <ResourceChildCollection
      urlKey="biosets"
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
