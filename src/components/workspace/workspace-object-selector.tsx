"use client";

import * as React from "react";
import { WorkspaceObjectSelectorView } from "./workspace-object-selector-view";
import { useWorkspaceObjectSearch } from "@/hooks/services/workspace/use-workspace-object-search";
import { WorkspaceObject } from "@/lib/services/workspace/types";
import { validateWorkspaceObjectTypes } from "@/lib/services/workspace/helpers";
import { ValidWorkspaceObjectTypes } from "@/lib/services/workspace/types";
import {
  resolveSelectorPreset,
  type WorkspaceSelectorPreset,
} from "./workspace-selector-presets";
import { useAuth } from "@/lib/auth/provider";
import { workspaceUsername } from "@/lib/services/workspace/path-utils";

interface WorkspaceObjectSelectorProps {
  id?: string;
  onObjectSelect?: (object: WorkspaceObject) => void;
  onSearch?: (query: string) => void;
  onSelectedObjectChange?: (object: WorkspaceObject | null) => void;
  placeholder?: string;
  className?: string;
  path?: string;
  types?: ValidWorkspaceObjectTypes | ValidWorkspaceObjectTypes[];
  /** Optional preset that supplies `types`; if set, takes precedence over `types`. */
  preset?: WorkspaceSelectorPreset;
  value?: string;
  filter?: (object: WorkspaceObject) => boolean;
}

function useWorkspaceObjectSelector({
  id,
  onObjectSelect,
  onSearch,
  onSelectedObjectChange,
  placeholder = "Search workspace objects...",
  className,
  path = "/home/",
  types,
  preset,
  value,
  filter,
}: WorkspaceObjectSelectorProps) {
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [isManualTrigger, setIsManualTrigger] = React.useState(false);
  const selectedObjectRef = React.useRef<WorkspaceObject | null>(null);
  const [displayName, setDisplayName] = React.useState<string>("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [dropdownPosition, setDropdownPosition] = React.useState<{
    openUpward: boolean;
    maxHeight: number;
  }>({ openUpward: false, maxHeight: 640 });
  const [dropdownRect, setDropdownRect] = React.useState<{
    top: number;
    left: number;
    width: number;
    /** When openUpward, bottom (from viewport bottom) so dropdown is anchored above input and shrinks from top */
    bottom?: number;
  } | null>(null);
  const inputRef = React.useRef<HTMLDivElement>(null);
  const inputElementRef = React.useRef<HTMLInputElement | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Effective types come from either the preset or the explicit `types` prop.
  const effectiveTypes: ValidWorkspaceObjectTypes[] | undefined = preset
    ? resolveSelectorPreset(preset)
    : types
      ? Array.isArray(types)
        ? types
        : [types]
      : undefined;

  const validatedTypes = (() => {
    if (!effectiveTypes) return undefined;
    const { valid, invalid } = validateWorkspaceObjectTypes(effectiveTypes);
    if (invalid.length > 0) {
      return { valid: valid.length > 0 ? valid : undefined, invalid };
    }
    return { valid, invalid: [] as string[] };
  })();

  const validationError =
    validatedTypes && validatedTypes.invalid.length > 0
      ? `Invalid upload type(s): ${validatedTypes.invalid.join(", ")}. Valid types include: unspecified, aligned_dna_fasta, reads, contigs, etc.`
      : null;
  const resolvedTypes = validatedTypes?.valid;

  // Use the repository-backed object search hook
  const {
    objects,
    filteredObjects,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    search,
  } = useWorkspaceObjectSearch({
    username: workspaceUsername(user),
    path,
    types: resolvedTypes,
  });

  const handleSearchChange = (value: string) => {
    search(value);
    setShowDropdown(value.length > 0);
    setIsManualTrigger(false);
    onSearch?.(value);
  };

  const handleObjectClick = (
    object: WorkspaceObject,
    immediateSelect = false,
  ) => {
    // Populate the input field
    const objectName = object.name || "";
    setSearchQuery(objectName);
    selectedObjectRef.current = object;
    setDisplayName(objectName);
    onSelectedObjectChange?.(object);
    setShowDropdown(false);
    setHighlightedIndex(-1);

    // If immediateSelect is true or onObjectSelect is provided without onSelectedObjectChange,
    // call onObjectSelect immediately (for OutputFolder use case)
    if (immediateSelect || (onObjectSelect && !onSelectedObjectChange)) {
      onObjectSelect?.(object);
      // Keep the display name but clear search query for controlled mode
      setSearchQuery("");
      selectedObjectRef.current = null;
      onSelectedObjectChange?.(null);
    }
  };

  const handleManualDropdownToggle = () => {
    setShowDropdown(!showDropdown);
    setIsManualTrigger(!showDropdown);
    setHighlightedIndex(-1);
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

  React.useEffect(() => {
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

  // Calculate dropdown position and rect for portal (so it isn't clipped by Card overflow)
  const updateDropdownLayout = React.useEffectEvent(() => {
    if (!showDropdown || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const preferredHeight = 640;
    const minHeight = 288;
    const gap = 4;
    // Cap height when opening upward so dropdown stays near the trigger instead of at viewport top
    const maxHeightUpward = 360;

    let openUpward = false;
    let maxHeight = preferredHeight;

    // Prefer opening downward when there's any reasonable space below so dropdown stays next to trigger
    if (spaceBelow >= minHeight) {
      openUpward = false;
      maxHeight = Math.min(spaceBelow - gap - 20, preferredHeight);
      maxHeight = Math.max(maxHeight, minHeight);
    } else if (spaceAbove >= minHeight) {
      openUpward = true;
      maxHeight = Math.min(spaceAbove - gap - 20, maxHeightUpward);
      maxHeight = Math.max(maxHeight, minHeight);
    } else {
      openUpward = false;
      maxHeight = Math.max(spaceBelow - 20, minHeight);
    }

    setDropdownPosition({ openUpward, maxHeight });
    setDropdownRect({
      top: openUpward ? rect.top - maxHeight - gap : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      ...(openUpward && { bottom: viewportHeight - (rect.top - gap) }),
    });
  });

  React.useEffect(() => {
    if (showDropdown && inputRef.current) {
      // Defer so layout is measured after DOM update (avoids wrong position when opening)
      const raf = requestAnimationFrame(() => {
        updateDropdownLayout();
      });
      return () => {
        cancelAnimationFrame(raf);
      };
    }
    setDropdownRect(null);
  }, [showDropdown]);

  // Update portal position on scroll/resize so dropdown stays aligned
  React.useEffect(() => {
    if (!showDropdown) return;
    const handleUpdate = () => {
      updateDropdownLayout();
    };
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [showDropdown]);

  // Use filtered objects from hook, with manual trigger override.
  const candidateObjects = isManualTrigger ? objects : filteredObjects;
  const displayObjects = filter
    ? candidateObjects.filter(filter)
    : candidateObjects;

  // Track previous value to avoid unnecessary updates
  const previousValueRef = React.useRef<string | undefined>(value);
  // Track which value we've already resolved (found or derived) so we don't
  // re-run derivation on every objects-list refresh or displayName change.
  const resolvedValueRef = React.useRef<string | undefined>(undefined);

  // Find object by path when value is provided to display its name and set selected object
  React.useEffect(() => {
    const valueChanged = previousValueRef.current !== value;
    if (valueChanged) previousValueRef.current = value;

    if (value && objects.length > 0) {
      // Only update if value changed or this value hasn't been resolved yet
      // (handles the case where objects load after the initial render)
      if (valueChanged || resolvedValueRef.current !== value) {
        resolvedValueRef.current = value;
        const foundObject = objects.find((obj) => obj.path === value);
        queueMicrotask(() => {
          if (foundObject) {
            setDisplayName(foundObject.name || "");
            selectedObjectRef.current = foundObject;
          } else {
            // Object not in the loaded list (e.g. a subfolder not fetched at this level).
            // Derive a display name from the last path segment.
            const derivedName = value.split("/").filter(Boolean).pop() ?? value;
            setDisplayName(derivedName);
            selectedObjectRef.current = null;
            setSearchQuery("");
          }
        });
      }
    } else if (!value && valueChanged) {
      // Clear display name and selected object when value is cleared
      resolvedValueRef.current = undefined;
      queueMicrotask(() => {
        setDisplayName("");
        selectedObjectRef.current = null;
        setSearchQuery("");
      });
    }
  }, [value, objects, setSearchQuery]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || displayObjects.length === 0) {
      if (event.key === "Enter" && selectedObjectRef.current) {
        event.preventDefault();
        onObjectSelect?.(selectedObjectRef.current);
        setSearchQuery("");
        selectedObjectRef.current = null;
        onSelectedObjectChange?.(null);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((previous) =>
          previous < displayObjects.length - 1 ? previous + 1 : previous,
        );
        setShowDropdown(true);
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((previous) => (previous > 0 ? previous - 1 : -1));
        setShowDropdown(true);
        break;
      case "Enter": {
        event.preventDefault();
        const hasHighlightedObject =
          highlightedIndex >= 0 && highlightedIndex < displayObjects.length;
        if (hasHighlightedObject) {
          handleObjectClick(
            displayObjects[highlightedIndex],
            !onSelectedObjectChange,
          );
        } else if (selectedObjectRef.current && !onSelectedObjectChange) {
          onObjectSelect?.(selectedObjectRef.current);
          setSearchQuery("");
          selectedObjectRef.current = null;
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <WorkspaceObjectSelectorView
      id={id}
      className={className}
      placeholder={placeholder}
      validationError={validationError}
      inputValue={searchQuery || displayName || value || ""}
      searchQuery={searchQuery}
      objects={displayObjects}
      loading={loading}
      error={error}
      showDropdown={showDropdown}
      highlightedIndex={highlightedIndex}
      dropdownLayout={{
        ...dropdownPosition,
        rect: dropdownRect,
      }}
      inputRef={inputRef}
      inputElementRef={inputElementRef}
      dropdownRef={dropdownRef}
      itemRefs={itemRefs}
      onInputChange={(event) => {
        handleSearchChange(event.target.value);
        selectedObjectRef.current = null;
        setDisplayName("");
        onSelectedObjectChange?.(null);
        setHighlightedIndex(-1);
      }}
      onInputFocus={() => {
        if (searchQuery.length > 0 || isManualTrigger) setShowDropdown(true);
      }}
      onInputKeyDown={handleInputKeyDown}
      onToggleDropdown={handleManualDropdownToggle}
      onObjectClick={(object) => {
        handleObjectClick(object, !onSelectedObjectChange);
      }}
      onObjectHighlight={setHighlightedIndex}
    />
  );
}

export function WorkspaceObjectSelector(props: WorkspaceObjectSelectorProps) {
  return useWorkspaceObjectSelector(props);
}
