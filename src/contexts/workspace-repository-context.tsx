"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  httpWorkspaceRepository,
  publicHttpWorkspaceRepository,
} from "@/lib/services/workspace/adapters/http-workspace-repository";
import type { WorkspaceRepository } from "@/lib/services/workspace/workspace-repository";

export interface WorkspaceRepositorySet {
  authenticated: WorkspaceRepository;
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

/** Injects a repository pair; without it consumers get the default HTTP adapters. */
export function WorkspaceRepositoryProvider({
  value,
  children,
}: WorkspaceRepositoryProviderProps) {
  const merged: WorkspaceRepositorySet = {
    authenticated: value?.authenticated ?? defaultRepositories.authenticated,
    public: value?.public ?? defaultRepositories.public,
  };

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
