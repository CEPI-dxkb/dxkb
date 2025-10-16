import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { WorkspaceObject, WorkspaceApi } from "@/lib/workspace-api";

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
  autoLoad = true
}: UseWorkspaceObjectsOptions): UseWorkspaceObjectsReturn {
  const [allObjects, setAllObjects] = useState<WorkspaceObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const apiClientRef = useRef<WorkspaceApi | undefined>(undefined);

  // Initialize API client only once
  if (!apiClientRef.current) {
    apiClientRef.current = new WorkspaceApi(undefined);
  }

  // Stabilize types array to prevent unnecessary re-renders
  const typesString = types ? JSON.stringify([...types].sort()) : "";
  const stableTypes = useMemo(() => types, [typesString]);

  // Local filtering function - no API calls
  const search = useCallback((query: string) => {
    console.log("🔍 LOCAL SEARCH: Filtering objects with query:", query);
    setSearchQuery(query);
  }, []);

  const refresh = useCallback(async () => {
    if (!user || !apiClientRef.current) return;

    console.log("🔄 REFRESH API CALL: Refreshing objects for user:", user, "path:", path, "types:", stableTypes);
    setLoading(true);
    setError(null);

    try {
      let result: WorkspaceObject[];

      if (stableTypes && stableTypes.length > 0) {
        // Load specific types
        const promises = stableTypes.map(type => 
          apiClientRef.current!.ls.getObjectsByType(user, type, path)
        );
        const results = await Promise.all(promises);
        result = results.flat();
      } else {
        // Load all objects
        result = await apiClientRef.current!.ls.listObjects({
          paths: [`/${user}@bvbrc${path}`],
          excludeDirectories: false,
          excludeObjects: false,
          recursive: true
        });
      }

      console.log("Loaded objects result:", result);
      setAllObjects(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load workspace objects";
      setError(errorMessage);
      console.error("Error loading workspace objects:", err);
    } finally {
      setLoading(false);
    }
  }, [user, path, stableTypes]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  // Filter objects based on search query
  const filteredObjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return allObjects;
    }

    return allObjects.filter(obj =>
      obj && obj.name && obj.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allObjects, searchQuery]);

  // Auto-load on mount and when dependencies change
  useEffect(() => {
    if (autoLoad && user && apiClientRef.current) {
      console.log("🔄 API CALL: Loading objects for user:", user, "path:", path, "types:", stableTypes);
      const loadObjects = async () => {
        setLoading(true);
        setError(null);

        try {
          let result: WorkspaceObject[];

          if (stableTypes && stableTypes.length > 0) {
            // Load specific types
            const promises = stableTypes.map(type => 
              apiClientRef.current!.ls.getObjectsByType(user, type, path)
            );
            const results = await Promise.all(promises);
            result = results.flat();
          } else {
            // Load all objects
            result = await apiClientRef.current!.ls.listObjects({
              paths: [`/${user}@bvbrc${path}`],
              excludeDirectories: false,
              excludeObjects: false,
              recursive: true
            });
          }

          console.log("✅ API CALL COMPLETE: Loaded objects result:", result);
          setAllObjects(result);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Failed to load workspace objects";
          setError(errorMessage);
          console.error("❌ API CALL ERROR:", err);
        } finally {
          setLoading(false);
        }
      };

      loadObjects();
    }
  }, [autoLoad, user, path, stableTypes]);

  return {
    objects: allObjects,
    filteredObjects,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    refresh,
    search,
    clearSearch
  };
}
