"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourceChildCollection } from "@/components/views";
import { DataRepository } from "@/lib/data-api";
import { keywordQuery } from "@/lib/data-api/keyword-terms";
import {
  experimentBiosetCollectionRql,
  experimentCollectionScopeRql,
} from "@/lib/experiment-view";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import type { CollectionState } from "@/lib/views/collection-state";

const repository = new DataRepository();
const maxScopedExperiments = 500;
/** `formatUserFacingErrorMessage` fallback for a failure that says nothing. */
const genericScopeErrorMessage =
  "The matching experiments could not be loaded. Please try again.";

interface ExperimentBiosetCollectionProps {
  experimentState: CollectionState;
}

export function ExperimentBiosetCollection({
  experimentState,
}: ExperimentBiosetCollectionProps) {
  const experimentRql = experimentCollectionScopeRql(experimentState);
  // Text without terms (blank, `""`, a lone `OR`, only syntax) searches for
  // nothing.
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
          // As the Experiments tab sends it, so both tabs cover the same
          // experiments.
          keywordMode: "exact",
          fields: ["exp_id"],
          limit: maxScopedExperiments + 1,
        },
        signal,
      ),
    enabled: hasExperimentScope,
  });

  if (experimentIds.isPending && hasExperimentScope) {
    return (
      <Skeleton
        className="m-4 min-h-96 flex-1"
        role="status"
        aria-label="Loading Biosets"
      />
    );
  }
  // The alerts sit in padding rather than taking a margin: an Alert is
  // `w-full`, so a horizontal margin pushed it past the content's right edge.
  if (experimentIds.error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTitle>Could not load biosets</AlertTitle>
          <AlertDescription>
            <p>
              {formatUserFacingErrorMessage(
                experimentIds.error,
                genericScopeErrorMessage,
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              aria-busy={experimentIds.isFetching || undefined}
              onClick={() => {
                void experimentIds.refetch();
              }}
            >
              {experimentIds.isFetching ? "Retrying…" : "Retry"}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const ids = experimentIds.data?.rows.map((row) => String(row.exp_id)) ?? [];
  if (ids.length > maxScopedExperiments) {
    return (
      <div className="p-4">
        <Alert>
          <AlertTitle>Refine the Experiment search</AlertTitle>
          <AlertDescription>
            Biosets can be shown for up to {maxScopedExperiments} matching
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
