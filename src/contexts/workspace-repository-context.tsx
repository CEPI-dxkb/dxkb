"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  httpWorkspaceRepository,
  publicHttpWorkspaceRepository,
} from "@/lib/services/workspace/adapters/http-workspace-repository";
import type { WorkspaceRepository } from "@/lib/services/workspace/workspace-repository";

export interface WorkspaceRepositorySet {
  /** Authenticated workspace (cookie-based). */
  authenticated: WorkspaceRepository;
  /** Public workspace (no auth required). */
  public: WorkspaceRepository;
}

const defaultRepositories: WorkspaceRepositorySet = {
  authenticated: httpWorkspaceRepository,
  public: publicHttpWorkspaceRepository,
};

const WorkspaceRepositoryContext = createContext<WorkspaceRepositorySet | null>(
  null,
);

export interface WorkspaceRepositoryProviderProps {
  value?: Partial<WorkspaceRepositorySet>;
  children: ReactNode;
}

/**
 * Injects a `WorkspaceRepository` pair into the tree. Production trees can
 * omit this provider and consumers will get the default HTTP adapters. Tests
 * and stories pass an `InMemoryWorkspaceRepository` via `value`.
 */
export function WorkspaceRepositoryProvider({
  value,
  children,
}: WorkspaceRepositoryProviderProps) {
  const merged = useMemo<WorkspaceRepositorySet>(
    () => ({
      authenticated: value?.authenticated ?? defaultRepositories.authenticated,
      public: value?.public ?? defaultRepositories.public,
    }),
    [value?.authenticated, value?.public],
  );

  return (
    <WorkspaceRepositoryContext.Provider value={merged}>
      {children}
    </WorkspaceRepositoryContext.Provider>
  );
}

export function useWorkspaceRepository(
  kind: "authenticated" | "public" = "authenticated",
): WorkspaceRepository {
  const ctx = useContext(WorkspaceRepositoryContext);
  if (ctx) return ctx[kind];
  return defaultRepositories[kind];
}
