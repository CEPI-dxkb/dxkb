"use client";

import {
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import { ApiError } from "@/lib/api/api-error";

// ---------------------------------------------------------------------------
// useApiQuery
// ---------------------------------------------------------------------------

interface ApiQueryConfig<TResult> {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  queryKey: unknown[];
  /** Transform the parsed JSON before returning */
  select?: (data: unknown) => TResult;
  /** Return "text" to call response.text() instead of response.json() */
  responseType?: "json" | "text";
  queryOptions?: Partial<
    Omit<UseQueryOptions<TResult, ApiError>, "queryKey" | "queryFn" | "select">
  >;
}

export function useApiQuery<TResult = unknown>(
  config: ApiQueryConfig<TResult>,
) {
  const authenticatedFetch = useAuthenticatedFetch();
  const {
    url,
    method = "GET",
    body,
    queryKey,
    select,
    responseType = "json",
    queryOptions,
  } = config;

  return useQuery<TResult, ApiError>({
    queryKey,
    queryFn: async (): Promise<TResult> => {
      const fetchOptions: RequestInit = { method };
      if (body !== undefined) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await authenticatedFetch(url, fetchOptions);

      if (!response.ok) {
        throw new ApiError(response.status, await response.text());
      }

      const data =
        responseType === "text" ? await response.text() : await response.json();

      return select ? select(data) : (data as TResult);
    },
    ...queryOptions,
  });
}

// ---------------------------------------------------------------------------
// useApiMutation
// ---------------------------------------------------------------------------

interface ApiMutationConfig<TResult, TVariables> {
  url: string | ((vars: TVariables) => string);
  method?: "POST" | "PUT" | "DELETE";
  buildBody?: (vars: TVariables) => unknown;
  /** Transform the parsed JSON before returning */
  select?: (data: unknown) => TResult;
  responseType?: "json" | "text";
  mutationOptions?: Partial<
    Omit<UseMutationOptions<TResult, ApiError, TVariables>, "mutationFn">
  >;
}

export function useApiMutation<TResult = unknown, TVariables = void>(
  config: ApiMutationConfig<TResult, TVariables>,
) {
  const authenticatedFetch = useAuthenticatedFetch();
  const {
    url,
    method = "POST",
    buildBody,
    select,
    responseType = "json",
    mutationOptions,
  } = config;

  return useMutation<TResult, ApiError, TVariables>({
    mutationFn: async (variables: TVariables): Promise<TResult> => {
      const resolvedUrl = typeof url === "function" ? url(variables) : url;
      const fetchOptions: RequestInit = { method };

      if (buildBody) {
        fetchOptions.body = JSON.stringify(buildBody(variables));
      }

      const response = await authenticatedFetch(resolvedUrl, fetchOptions);

      if (!response.ok) {
        throw new ApiError(response.status, await response.text());
      }

      const data =
        responseType === "text" ? await response.text() : await response.json();

      return select ? select(data) : (data as TResult);
    },
    ...mutationOptions,
  });
}
