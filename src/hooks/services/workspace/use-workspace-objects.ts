import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { WorkspaceObject, WorkspaceApi } from "@/lib/workspace-client";

// Module-level singleton for API calls
let workspaceApiSingleton: WorkspaceApi | undefined;
function getWorkspaceApi(): WorkspaceApi {
  if (!workspaceApiSingleton) {
    workspaceApiSingleton = new WorkspaceApi(undefined);
  }
  return workspaceApiSingleton;
}

async function fetchWorkspaceObjects(
  user: string,
  path: string,
  types: string[] | undefined,
): Promise<WorkspaceObject[]> {
  const api = getWorkspaceApi();

  if (types && types.length > 0) {
    const allResults = await api.ls.listObjects({
      paths: [`/${user}@bvbrc${path}`],
      excludeDirectories: false,
      excludeObjects: false,
      query: { type: types },
      recursive: true,
    });
    return allResults.filter(
      (obj: WorkspaceObject) => types.indexOf(obj.type) >= 0,
    );
  }

  return api.ls.listObjects({
    paths: [`/${user}@bvbrc${path}`],
    excludeDirectories: false,
    excludeObjects: false,
    recursive: true,
  });
}

interface UseWorkspaceObjectsOptions {
  user: string;
  path?: string;
  types?: string[];
  autoLoad?: boolean;
}

interface UseWorkspaceObjectsReturn {
  objects: WorkspaceObject[];
  filteredObjects: WorkspaceObject[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refresh: () => Promise<void>;
  search: (query: string) => void;
  clearSearch: () => void;
}

export function useWorkspaceObjects({
  user,
  path = "/home/",
  types,
  autoLoad = true,
}: UseWorkspaceObjectsOptions): UseWorkspaceObjectsReturn {
  const [searchQuery, setSearchQuery] = useState("");

  // Stabilize types array to prevent unnecessary re-renders
  const typesKey = types ? JSON.stringify([...types].sort()) : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableTypes = useMemo(() => types, [typesKey]);

  const query = useQuery<WorkspaceObject[], Error>({
    queryKey: ["workspace-objects", user, path, typesKey],
    queryFn: () => fetchWorkspaceObjects(user, path, stableTypes),
    enabled: autoLoad && !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data, refetch } = query;

  const allObjects = useMemo(() => data ?? [], [data]);

  // Local filtering function - no API calls
  const search = useCallback((q: string) => {
    setSearchQuery(q);
  }, []);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  // Filter objects based on search query
  const filteredObjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return allObjects;
    }
    return allObjects.filter(
      (obj) =>
        obj &&
        obj.name &&
        obj.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [allObjects, searchQuery]);

  return {
    objects: allObjects,
    filteredObjects,
    loading: query.isLoading || query.isRefetching,
    error: query.error?.message ?? null,
    searchQuery,
    setSearchQuery,
    refresh,
    search,
    clearSearch,
  };
}
