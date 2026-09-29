import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { AuthUser } from "@/lib/auth/types";
import {
  defaultUiPreferences,
  type UiPreferences,
} from "@/lib/ui-preferences/definitions";
import { UiPreferencesProvider } from "@/lib/ui-preferences/provider";

export const testAuthUser: AuthUser = {
  id: "testuser",
  username: "testuser",
  email: "test@example.com",
  email_verified: true,
};

export function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

export function createUiPreferencesWrapper(
  overrides: Partial<UiPreferences> = {},
) {
  const initialPreferences = { ...defaultUiPreferences, ...overrides };
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      UiPreferencesProvider,
      { initialPreferences },
      children,
    );
  };
}
