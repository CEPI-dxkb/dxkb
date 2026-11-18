"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourceChildCollection } from "@/components/views/resource-child-collection";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { DataRepository } from "@/lib/data-api";
import { keywordQuery } from "@/lib/data-api/keyword-terms";
import {
  experimentBiosetScopeRql,
  experimentCollectionScopeRql,
  maxBiosetScopeExperiments,
} from "@/lib/experiment-view";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import type { CollectionState } from "@/lib/views/collection-state";

const repository = new DataRepository();
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
  /**
   * Where to narrow the experiments when too many match to list their Biosets.
   * Pass it when this view has no search of its own (a taxon tab); without it the
   * view asks for a keyword or filter on the Experiment search it was given.
   */
  refineHref?: string;
}

/** A blank predicate is no predicate. */
function presentRql(rql: string | undefined): string | undefined {
  return rql?.trim() ? rql : undefined;
}

export function ExperimentBiosetCollection({
  experimentState = unscopedExperimentState,
  baseRql,
  refineHref,
}: ExperimentBiosetCollectionProps) {
  const scopeRql = presentRql(baseRql);
  const searchRql = experimentCollectionScopeRql(experimentState);
  const experimentRql =
    scopeRql && searchRql ? `and(${scopeRql},${searchRql})` : scopeRql ?? searchRql;
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
          limit: maxBiosetScopeExperiments + 1,
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
  const biosetRql = hasExperimentScope
    ? experimentBiosetScopeRql(ids)
    : "eq(bioset_id,*)";
  if (biosetRql === null) {
    return (
      <div className="p-4">
        <Alert>
          <AlertTitle>Too many Experiments to list their Biosets</AlertTitle>
          <AlertDescription>
            {refineHref ? (
              <p>
                {ids.length.toLocaleString()} Experiments match, more than one
                Biosets query can name.{" "}
                <Link
                  href={refineHref}
                  className="text-primary underline underline-offset-2 dark:text-link"
                >
                  Narrow them in the Experiment search
                </Link>
                , then open its Biosets tab.
              </p>
            ) : (
              <p>
                {ids.length.toLocaleString()} Experiments match, more than one
                Biosets query can name. Add a keyword or filter to narrow the
                results.
              </p>
            )}
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
      rql={biosetRql}
      defaultSort="bioset_id:asc"
    />
  );
}
