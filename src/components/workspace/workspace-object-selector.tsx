"use client";

import * as React from "react";
import {
  Search,
  FolderOpen,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWorkspaceObjects } from "@/hooks/use-workspace-objects";
import { WorkspaceObject } from "@/lib/workspace-api";
import { validateWorkspaceObjectTypes } from "@/lib/workspace/helpers";
import { ValidWorkspaceObjectTypes } from "@/lib/workspace/types";
import { useAuth } from "@/contexts/auth-context";

interface WorkspaceObjectSelectorProps {
  onObjectSelect?: (object: WorkspaceObject) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
  path?: string;
  types?: ValidWorkspaceObjectTypes | ValidWorkspaceObjectTypes[];
}

export function WorkspaceObjectSelector({
  onObjectSelect,
  onSearch,
  placeholder = "Search workspace objects...",
  className,
  path = "/home/",
  types,
}: WorkspaceObjectSelectorProps) {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [isManualTrigger, setIsManualTrigger] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );
  const [dropdownPosition, setDropdownPosition] = React.useState<{
    openUpward: boolean;
    maxHeight: number;
  }>({ openUpward: false, maxHeight: 640 });
  const inputRef = React.useRef<HTMLDivElement>(null);

  // Ref to store last validated types to prevent unnecessary re-validation
  const lastValidatedTypesRef = React.useRef<{
    types: string;
    result: ValidWorkspaceObjectTypes[] | undefined;
  } | null>(null);

  // Normalize and validate types prop with caching
  const validatedTypes = React.useMemo(() => {
    if (!types) {
      setValidationError(null);
      console.log("No types provided");
      return undefined;
    }

    // Convert single type to array
    const typesArray = Array.isArray(types) ? types : [types];
    const typesString = typesArray.join(',');

    // Check if we've already validated this exact types array
    if (lastValidatedTypesRef.current?.types === typesString) {
      return lastValidatedTypesRef.current.result;
    }

    // Validate all types
    const { valid, invalid } = validateWorkspaceObjectTypes(typesArray);

    let result: ValidWorkspaceObjectTypes[] | undefined;

    if (invalid.length > 0) {
      const errorMsg = `Invalid upload type(s): ${invalid.join(", ")}. Valid types include: unspecified, aligned_dna_fasta, reads, contigs, etc.`;
      setValidationError(errorMsg);
      console.error(errorMsg);
      // Return only valid types if any exist, otherwise undefined
      result = valid.length > 0 ? valid : undefined;
    } else {
      setValidationError(null);
      result = valid;
    }

    // Cache the result
    lastValidatedTypesRef.current = {
      types: typesString,
      result
    };

    return result;
  }, [types]);

  // Use the workspace objects hook
  const {
    objects,
    filteredObjects,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    search,
    clearSearch,
  } = useWorkspaceObjects({
    user: user?.username || "",
    path,
    types: validatedTypes,
  });

  const handleSearchChange = (value: string) => {
    search(value);
    setShowDropdown(value.length > 0);
    setIsManualTrigger(false);
    onSearch?.(value);
  };

  const handleObjectClick = (object: WorkspaceObject) => {
    setSearchQuery(object.name || "");
    setShowDropdown(false);
    onObjectSelect?.(object);
  };

  const handleFolderClick = () => {
    setIsDialogOpen(true);
  };

  const handleManualDropdownToggle = () => {
    setShowDropdown(!showDropdown);
    setIsManualTrigger(!showDropdown);
  };

  // Calculate dropdown position based on available space
  React.useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const preferredHeight = 640; // Original max-h-160 value
      const minHeight = 288; // Fallback max-h-72 value

      // Decide if we should open upward or downward
      if (spaceBelow >= preferredHeight) {
        // Plenty of space below, use preferred height
        setDropdownPosition({ openUpward: false, maxHeight: preferredHeight });
      } else if (spaceAbove >= preferredHeight) {
        // Not enough space below but enough above
        setDropdownPosition({ openUpward: true, maxHeight: preferredHeight });
      } else if (spaceBelow >= spaceAbove) {
        // More space below than above, shrink to fit
        setDropdownPosition({
          openUpward: false,
          maxHeight: Math.max(spaceBelow - 20, minHeight),
        });
      } else {
        // More space above than below, shrink to fit
        setDropdownPosition({
          openUpward: true,
          maxHeight: Math.max(spaceAbove - 20, minHeight),
        });
      }
    }
  }, [showDropdown]);

  // Use filtered objects from hook, with manual trigger override
  const displayObjects = React.useMemo(() => {
    if (!filteredObjects || !Array.isArray(filteredObjects)) {
      return []; // Return empty array if filteredObjects is undefined or not an array
    }
    if (isManualTrigger) {
      console.log("Manual trigger - returning all objects:", objects);
      return objects; // Show all objects when manually triggered
    }
    return filteredObjects;
  }, [filteredObjects, objects, isManualTrigger, showDropdown]);

  return (
    <div className={className ? `relative ${className}` : "relative w-full"}>
      {/* Validation Error Alert */}
      {validationError && (
        <Alert variant="destructive" className="mb-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {/* Single Row Layout */}
      <div className="flex flex-row items-center gap-2">
        {/* Search Input with Dropdown */}
        <div ref={inputRef} className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setShowDropdown(searchQuery.length > 0)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            className="w-full pr-10 pl-10"
          />
          {/* Manual Dropdown Trigger */}
          <Button
            type="button"
            onClick={handleManualDropdownToggle}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 transition-colors"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showDropdown ? "rotate-180" : ""}`}
            />
          </Button>

          {/* Live Search Dropdown */}
          {showDropdown && (
            <div
              className={`bg-popover scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 dark:scrollbar-thumb-muted-foreground/30 dark:hover:scrollbar-thumb-muted-foreground/50 absolute right-0 left-0 z-50 overflow-y-auto rounded-md border shadow-md ${
                dropdownPosition.openUpward
                  ? "bottom-full mb-1"
                  : "top-full mt-1"
              }`}
              style={{ maxHeight: `${dropdownPosition.maxHeight}px` }}
            >
              {error ? (
                <div className="p-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Failed to load workspace objects: {error}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground text-sm">
                    Loading...
                  </span>
                </div>
              ) : displayObjects.length > 0 ? (
                displayObjects.map((object, index) => {
                  if (!object) return null; // Skip undefined objects

                  // Remove user@workspace prefix from path
                  const cleanPath =
                    object.path?.replace(/^\/[^/]+@[^/]+/, "") ||
                    object.path ||
                    object.name ||
                    "Unnamed Object";

                  return (
                    <div
                      key={`${object.id}-${index}`}
                      className="hover:bg-accent flex cursor-pointer items-center justify-between p-2"
                      onClick={() => handleObjectClick(object)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {object.name}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {cleanPath}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  {searchQuery
                    ? "No objects found matching your search"
                    : "No objects found"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Folder Icon Button */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleFolderClick}
              className="shrink-0"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] max-w-4xl">
            <DialogHeader>
              <DialogTitle>Choose or Upload a Workspace Object</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Placeholder content for workspace browser */}
              <div className="rounded-lg border p-8 text-center">
                <FolderOpen className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-medium">Workspace Browser</h3>
                <p className="text-muted-foreground mb-4">
                  This will be the full workspace browser interface where users
                  can navigate folders, upload files, and select objects.
                </p>
                <div className="text-muted-foreground text-sm">
                  <p>Features to be implemented:</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    <li>Folder navigation with breadcrumbs</li>
                    <li>File and folder listing with details</li>
                    <li>Upload functionality</li>
                    <li>Search and filter options</li>
                    <li>Selection and confirmation</li>
                  </ul>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
