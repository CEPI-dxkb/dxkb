"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchFeaturesFromGroup,
  type FeatureSummary,
} from "@/lib/services/feature";

interface UseFeatureGroupOptionsReturn {
  features: FeatureSummary[];
  isLoading: boolean;
  error: string | null;
}

export function useFeatureGroupOptions(
  featureGroupPath: string | undefined,
  enabled = true,
): UseFeatureGroupOptionsReturn {
  const path = (featureGroupPath ?? "").trim();
  const shouldFetch = enabled && !!path;

  const { data = [], isFetching, error } = useQuery({
    queryKey: ["featureGroupOptions", path],
    queryFn: ({ signal }) => fetchFeaturesFromGroup(path, { signal }),
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    features: data,
    isLoading: shouldFetch && isFetching,
    error: error instanceof Error ? error.message : null,
  };
}
