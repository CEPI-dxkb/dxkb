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
import { useWorkspaceObjects } from "@/hooks/services/workspace/use-workspace-objects";
import { WorkspaceObject } from "@/lib/workspace-client";
import { validateWorkspaceObjectTypes } from "@/lib/services/workspace/helpers";
import { ValidWorkspaceObjectTypes } from "@/lib/services/workspace/types";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

interface WorkspaceObjectSelectorProps {
  onObjectSelect?: (object: WorkspaceObject) => void;
  onSearch?: (query: string) => void;
  onSelectedObjectChange?: (object: WorkspaceObject | null) => void;
  placeholder?: string;
  className?: string;
  path?: string;
  types?: ValidWorkspaceObjectTypes | ValidWorkspaceObjectTypes[];
  value?: string;
}

export function WorkspaceObjectSelector({
  onObjectSelect,
  onSearch,
  onSelectedObjectChange,
  placeholder = "Search workspace objects...",
  className,
  path = "/home/",
  types,
  value,
}: WorkspaceObjectSelectorProps) {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [isManualTrigger, setIsManualTrigger] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );
  const [selectedObject, setSelectedObject] = React.useState<WorkspaceObject | null>(null);
  const [displayName, setDisplayName] = React.useState<string>("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [dropdownPosition, setDropdownPosition] = React.useState<{
    openUpward: boolean;
    maxHeight: number;
  }>({ openUpward: false, maxHeight: 640 });
  const inputRef = React.useRef<HTMLDivElement>(null);
  const inputElementRef = React.useRef<HTMLInputElement | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([]);

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

  const handleObjectClick = (object: WorkspaceObject, immediateSelect = false) => {
    // Populate the input field
    const objectName = object.name || "";
    setSearchQuery(objectName);
    setSelectedObject(object);
    setDisplayName(objectName);
    onSelectedObjectChange?.(object);
    setShowDropdown(false);
    
    // If immediateSelect is true or onObjectSelect is provided without onSelectedObjectChange,
    // call onObjectSelect immediately (for OutputFolder use case)
    if (immediateSelect || (onObjectSelect && !onSelectedObjectChange)) {
      onObjectSelect?.(object);
      // Keep the display name but clear search query for controlled mode
      setSearchQuery("");
      setSelectedObject(null);
      onSelectedObjectChange?.(null);
    }
  };

  const handleFolderClick = () => {
    setIsDialogOpen(true);
  };

  const handleManualDropdownToggle = () => {
    setShowDropdown(!showDropdown);
    setIsManualTrigger(!showDropdown);
  };

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputElementRef.current &&
        !inputElementRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset highlighted index when displayObjects change
  React.useEffect(() => {
    setHighlightedIndex(-1);
    itemRefs.current = [];
  }, [filteredObjects, objects, isManualTrigger, showDropdown]);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [highlightedIndex]);

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

  // Track previous value to avoid unnecessary updates
  const previousValueRef = React.useRef<string | undefined>(value);

  // Find object by path when value is provided to display its name and set selected object
  React.useEffect(() => {
    const valueChanged = previousValueRef.current !== value;
    
    // Update the ref if value changed
    if (valueChanged) {
      previousValueRef.current = value;
    }

    // If we have a value and objects are loaded, try to find and display the object
    if (value && objects && objects.length > 0) {
      const foundObject = objects.find((obj) => obj.path === value);
      if (foundObject) {
        // Update display name and selected object if:
        // 1. Value changed, OR
        // 2. We don't have a display name yet, OR
        // 3. The selected object doesn't match the found object
        if (valueChanged || !displayName || selectedObject?.path !== foundObject.path) {
          setDisplayName(foundObject.name || "");
          setSelectedObject(foundObject);
        }
      } else {
        // If value doesn't match any object, clear display name and selected object
        // Only clear if value changed to avoid clearing when objects are still loading
        if (valueChanged) {
          setDisplayName("");
          setSelectedObject(null);
          setSearchQuery("");
        }
      }
    } else if (!value || value === "") {
      // Clear display name and selected object when value is cleared
      if (valueChanged) {
        setDisplayName("");
        setSelectedObject(null);
        setSearchQuery("");
      }
    }
  }, [value, objects, displayName, selectedObject]);

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
            ref={inputElementRef}
            placeholder={placeholder}
            value={searchQuery || displayName || (value !== undefined ? value : "")}
            onChange={(e) => {
              handleSearchChange(e.target.value);
              setSelectedObject(null);
              setDisplayName("");
              onSelectedObjectChange?.(null);
              setHighlightedIndex(-1);
            }}
            onFocus={() => {
              if (searchQuery.length > 0 || isManualTrigger) {
                setShowDropdown(true);
              }
            }}
            onKeyDown={(e) => {
              if (!showDropdown || displayObjects.length === 0) {
                // If no dropdown but we have a selected object, allow Enter to confirm selection
                if (e.key === "Enter" && selectedObject) {
                  e.preventDefault();
                  onObjectSelect?.(selectedObject);
                  setSearchQuery("");
                  setSelectedObject(null);
                  onSelectedObjectChange?.(null);
                }
                return;
              }

              switch (e.key) {
                case "ArrowDown":
                  e.preventDefault();
                  setHighlightedIndex((prev) =>
                    prev < displayObjects.length - 1 ? prev + 1 : prev
                  );
                  setShowDropdown(true);
                  break;
                case "ArrowUp":
                  e.preventDefault();
                  setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
                  setShowDropdown(true);
                  break;
                case "Enter":
                  e.preventDefault();
                  if (highlightedIndex >= 0 && highlightedIndex < displayObjects.length) {
                    const object = displayObjects[highlightedIndex];
                    if (object) {
                      // If onSelectedObjectChange is provided, use the '+' pattern (don't immediately select)
                      // Otherwise, immediately select (for OutputFolder use case)
                      const immediateSelect = !onSelectedObjectChange;
                      handleObjectClick(object, immediateSelect);
                    }
                  } else if (selectedObject) {
                    // If no highlight but we have a selected object, confirm it
                    // If onSelectedObjectChange is provided, use the '+' pattern (don't immediately select)
                    // Otherwise, immediately select (for OutputFolder use case)
                    if (!onSelectedObjectChange) {
                      onObjectSelect?.(selectedObject);
                      setSearchQuery("");
                      setSelectedObject(null);
                    }
                  }
                  break;
                case "Escape":
                  e.preventDefault();
                  setShowDropdown(false);
                  setHighlightedIndex(-1);
                  break;
              }
            }}
            className="service-card-input w-full pr-10 pl-10"
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
              ref={dropdownRef}
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

                  const isHighlighted = highlightedIndex === index;

                  return (
                    <div
                      key={`${object.id}-${index}`}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      className={cn(
                        "hover:bg-accent flex cursor-pointer items-center justify-between p-2",
                        isHighlighted && "bg-accent"
                      )}
                      onClick={() => {
                        // If onSelectedObjectChange is provided, use the '+' pattern (don't immediately select)
                        // Otherwise, immediately select (for OutputFolder use case)
                        const immediateSelect = !onSelectedObjectChange;
                        handleObjectClick(object, immediateSelect);
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
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
