"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "../contexts/auth-context";

// Client-side authenticated fetch hook
export function useAuthenticatedFetch() {
  const { user, refreshAuth } = useAuth();

  // Memoize the dependencies to prevent unnecessary re-creations
  const memoizedUser = useMemo(() => user, [user?.id, user?.email]); // Only depend on user identity, not the entire object
  const memoizedRefreshAuth = useMemo(() => refreshAuth, []); // refreshAuth should be stable

  return useCallback(
    async (url: string, options: RequestInit = {}) => {
      // For client-side requests, we rely on cookies being automatically included
      const response = await fetch(url, {
        ...options,
        credentials: "include", // Ensure cookies are sent
        headers: {
          ...options.headers,
          "Content-Type": "application/json",
        },
      });

      // If token expired, try to refresh
      if (response.status === 401) {
        await memoizedRefreshAuth();
        // Retry the request after refresh
        const retryResponse = await fetch(url, {
          ...options,
          credentials: "include",
          headers: {
            ...options.headers,
            "Content-Type": "application/json",
          },
        });
        return retryResponse;
      }

      return response;
    },
    [memoizedUser, memoizedRefreshAuth],
  );
}
