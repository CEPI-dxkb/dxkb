"use client";

import { CircleAlert, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import {
  ServiceCardContent,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import type { SimilarGenomeFinderController } from "./use-similar-genome-finder-form";

const columns = [
  { id: "genome_id", label: "Genome ID" },
  { id: "genome_name", label: "Genome Name" },
  { id: "organism_name", label: "Organism" },
  { id: "genome_status", label: "Genome Status" },
  { id: "genome_quality", label: "Genome Quality" },
  { id: "distance", label: "Distance" },
  { id: "pvalue", label: "P Value" },
  { id: "counts", label: "K-mer Counts" },
] as const;

export function ResultsSection({
  controller,
}: {
  controller: SimilarGenomeFinderController;
}) {
  const {
    results,
    isSubmitting,
    hasSearched,
    searchError,
    genomeDetailsError,
    retrySearch,
  } = controller;
  return (
    <div className="mt-8">
      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Results</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          {searchError ? (
            // A failed search is not "no similar genomes": say why, and
            // offer the same search again.
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Search failed</AlertTitle>
              <AlertDescription>
                <p>{searchError}</p>
                <Button variant="outline" size="sm" onClick={retrySearch}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : !hasSearched ? (
            <p className="text-sm text-muted-foreground">
              Run a search to see similar genomes.
            </p>
          ) : (
            <>
              {genomeDetailsError ? (
                <Alert className="mb-4">
                  <Info aria-hidden="true" />
                  <AlertTitle>Genome names could not be loaded</AlertTitle>
                  <AlertDescription>
                    <p>{genomeDetailsError}</p>
                  </AlertDescription>
                </Alert>
              ) : null}
              <DataTable
                id="similar-genome-finder-results"
                data={results as unknown as Record<string, unknown>[]}
                columns={[...columns]}
                totalItems={results.length}
                resource="similar-genome-finder-results"
                isLoading={isSubmitting}
              />
            </>
          )}
        </ServiceCardContent>
      </Card>
    </div>
  );
}
