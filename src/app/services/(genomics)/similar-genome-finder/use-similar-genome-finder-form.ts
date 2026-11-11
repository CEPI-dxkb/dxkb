"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServiceDebugging } from "@/contexts/service-debugging-context";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import {
  defaultSimilarGenomeFinderFormValues,
  similarGenomeFinderFormSchema,
  type SimilarGenomeFinderFormData,
} from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-form-schema";
import { buildMinhashServicePayload } from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-form-utils";
import { noSimilarGenomeResults } from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-result-utils";
import { similarGenomeFinderService } from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-service";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { submitSimilarGenomes } from "./actions";

export function useSimilarGenomeFinderForm() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { isDebugMode } = useServiceDebugging();

  const search = useMutation({
    mutationFn: async (value: SimilarGenomeFinderFormData) => {
      const response = await submitSimilarGenomes(value);
      if (!response.success) throw new Error(response.error);
      return response;
    },
    onSuccess: (response) => {
      toast.success("Similar Genome Finder completed successfully!", {
        description:
          response.rows.length > 0
            ? `Results returned from Minhash service (${String(response.rows.length)} genome${response.rows.length === 1 ? "" : "s"})`
            : "Results returned from Minhash service",
        closeButton: true,
      });
    },
    onError: (error) => {
      toast.error("Search failed", {
        description: formatUserFacingErrorMessage(
          error,
          "Similar Genome Finder search failed",
        ),
        closeButton: true,
      });
    },
  });

  const form = useForm({
    defaultValues: defaultSimilarGenomeFinderFormValues,
    validators: { onChange: similarGenomeFinderFormSchema },
    onSubmit: async ({ value }) => {
      if (isDebugMode) {
        await runtime.previewOrSubmit(
          buildMinhashServicePayload(value) as unknown as Record<
            string,
            unknown
          >,
        );
        return;
      }
      await search.mutateAsync(value).catch(() => {
        /* shown inline in the Results card (and toasted) by the mutation */
      });
    },
  });

  const canSubmit = useSelector(form.store, (state) => state.canSubmit);
  const runtime = useServiceRuntime({
    definition: similarGenomeFinderService,
    form,
  });
  const isSubmitting = runtime.isSubmitting || search.isPending;

  function handleReset() {
    form.reset(defaultSimilarGenomeFinderFormValues);
    setShowAdvanced(false);
    search.reset();
  }

  function retrySearch() {
    if (search.variables) search.mutate(search.variables);
  }

  return {
    form,
    runtime,
    results: search.data?.rows ?? noSimilarGenomeResults,
    hasSearched: !search.isIdle,
    searchError: search.isError
      ? formatUserFacingErrorMessage(
          search.error,
          "Similar Genome Finder search failed",
        )
      : null,
    genomeDetailsError: search.data?.genomeDetailsError ?? null,
    retrySearch,
    canSubmit,
    isSubmitting,
    showAdvanced,
    setShowAdvanced,
    handleReset,
  };
}

export type SimilarGenomeFinderController = ReturnType<
  typeof useSimilarGenomeFinderForm
>;
