import { NextRequest } from "next/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

/**
 * Factory for creating mock NextRequest objects for route handler tests.
 */
export function mockNextRequest(
  opts: {
    method?: string;
    url?: string;
    body?: unknown;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {},
): NextRequest {
  const {
    method = "GET",
    url: baseUrl = "http://localhost:3019/api/test",
    body,
    headers = {},
    searchParams,
  } = opts;

  let finalUrl = baseUrl;
  if (searchParams) {
    const params = new URLSearchParams(searchParams);
    finalUrl = `${baseUrl}?${params.toString()}`;
  }

  const init: Record<string, unknown> = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };

  if (body !== undefined && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only helper; Next.js RequestInit differs from standard
  return new NextRequest(finalUrl, init as any);
}

/**
 * Creates a QueryClientProvider wrapper for use with renderHook.
 * Configured with retry: false for test stability.
 */
export function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

export function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

export async function json(res: Response) {
  return res.json();
}
