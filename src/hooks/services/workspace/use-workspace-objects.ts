import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { WorkspaceObject, WorkspaceApi } from "@/lib/workspace-client";

// Module-level cache to persist across component unmounts
const workspaceCache = new Map<string, { objects: WorkspaceObject[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

    const cacheKey = `${user}:${path}:${typesString}`;
    console.log("🔄 REFRESH API CALL: Refreshing objects for user:", user, "path:", path, "types:", stableTypes);
    setLoading(true);
    setError(null);

    try {
      let result: WorkspaceObject[];

      if (stableTypes && stableTypes.length > 0) {
        // Load specific types - use single API call with all types
        const allResults = await apiClientRef.current!.ls.listObjects({
          paths: [`/${user}@bvbrc${path}`],
          excludeDirectories: false,
          excludeObjects: false,
          query: {
            type: stableTypes,
          },
          recursive: true
        });
        // Apply client-side filtering to ensure only matching types are returned
        result = allResults.filter((obj: any) => {
          return stableTypes.indexOf(obj.type) >= 0;
        });
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
      // Update cache on manual refresh
      workspaceCache.set(cacheKey, { objects: result, timestamp: Date.now() });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load workspace objects";
      setError(errorMessage);
      console.error("Error loading workspace objects:", err);
    } finally {
      setLoading(false);
    }
  }, [user, path, stableTypes, typesString]);

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
      // Create a cache key based on user, path, and types
      const cacheKey = `${user}:${path}:${typesString}`;
      
      // Check module-level cache first
      const cached = workspaceCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log("📦 CACHE HIT: Using cached objects for:", cacheKey);
        setAllObjects(cached.objects);
        return;
      }

      console.log("🔄 API CALL: Loading objects for user:", user, "path:", path, "types:", stableTypes);
      const loadObjects = async () => {
        setLoading(true);
        setError(null);

        try {
          let result: WorkspaceObject[];

      if (stableTypes && stableTypes.length > 0) {
        // Load specific types - use single API call with all types
        const allResults = await apiClientRef.current!.ls.listObjects({
          paths: [`/${user}@bvbrc${path}`],
          excludeDirectories: false,
          excludeObjects: false,
          query: {
            type: stableTypes,
          },
          recursive: true
        });
        // Apply client-side filtering to ensure only matching types are returned
        result = allResults.filter((obj: any) => {
          return stableTypes.indexOf(obj.type) >= 0;
        });
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
          // Store in module-level cache
          workspaceCache.set(cacheKey, { objects: result, timestamp: now });
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
  }, [autoLoad, user, path, stableTypes, typesString]);

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
