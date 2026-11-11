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
import {
  preloadFolderPickerDialog,
  WorkspaceFolderPickerDialog,
} from "@/components/workspace/folder-picker/folder-picker-dialog-lazy";
import { toWorkspaceObject, type WorkspaceItem } from "@/lib/services/workspace/domain";
import { lastSegment, pickerTargetFor } from "@/lib/services/workspace/picker-views";
import { isFolderType } from "@/lib/services/workspace/utils";

interface WorkspaceObjectSelectorProps {
  id?: string;
  onObjectSelect?: (object: WorkspaceObject) => void;
  onSearch?: (query: string) => void;
  onSelectedObjectChange?: (object: WorkspaceObject | null) => void;
  placeholder?: string;
  className?: string;
  path?: string;
  types?: ValidWorkspaceObjectTypes | ValidWorkspaceObjectTypes[];
  preset?: WorkspaceSelectorPreset;
  value?: string;
  filter?: (object: WorkspaceObject) => boolean;
  invalid?: boolean;
  browse?: boolean;
  browseTitle?: string;
  disabled?: boolean;
  /**
   * Delays the recursive workspace search until the field is focused, typed in or
   * opened. Defaults to true: listing on mount sent one hanging `Workspace.ls` per
   * field during an outage.
   */
  searchOnInteraction?: boolean;
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
  invalid = false,
  browse = true,
  browseTitle,
  disabled = false,
  searchOnInteraction = true,
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
    bottom?: number;
  } | null>(null);
  const inputRef = React.useRef<HTMLDivElement>(null);
  const inputElementRef = React.useRef<HTMLInputElement | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const effectiveTypes: ValidWorkspaceObjectTypes[] | undefined = preset
    ? [...resolveSelectorPreset(preset)]
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
  const username = workspaceUsername(user);
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  // The picker mounts on the first Browse and stays mounted, so it keeps its
  // close animation and the layout it remembers between opens.
  const [hasOpenedPicker, setHasOpenedPicker] = React.useState(false);
  const [hasInteracted, setHasInteracted] = React.useState(false);
  const searchEnabled = !searchOnInteraction || hasInteracted;
  const pickerTarget =
    browse && resolvedTypes && resolvedTypes.length > 0
      ? pickerTargetFor(resolvedTypes)
      : null;

  const {
    objects,
    filteredObjects,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    search,
  } = useWorkspaceObjectSearch({
    username,
    path,
    types: resolvedTypes,
    autoLoad: searchEnabled,
  });

  const handleSearchChange = (value: string) => {
    setHasInteracted(true);
    search(value);
    setShowDropdown(value.length > 0);
    setIsManualTrigger(false);
    onSearch?.(value);
  };

  const handleObjectClick = (
    object: WorkspaceObject,
    immediateSelect = false,
  ) => {
    const objectName = object.name || "";
    setSearchQuery(objectName);
    selectedObjectRef.current = object;
    setDisplayName(objectName);
    onSelectedObjectChange?.(object);
    setShowDropdown(false);
    setHighlightedIndex(-1);

    if (immediateSelect || (onObjectSelect && !onSelectedObjectChange)) {
      onObjectSelect?.(object);
      setSearchQuery("");
      selectedObjectRef.current = null;
      onSelectedObjectChange?.(null);
    }
  };

  const handleBrowseSelect = (path: string, item: WorkspaceItem | null) => {
    handleObjectClick(
      item
        ? { ...toWorkspaceObject(item), path }
        : {
            id: path,
            name: lastSegment(path),
            path,
            type: "folder",
            isDirectory: true,
          },
      !onSelectedObjectChange,
    );
  };
  const isBrowseSelectable = filter
    ? (object: { name: string; path: string; type?: string }) =>
        filter({
          id: object.path,
          name: object.name,
          path: object.path,
          type: object.type ?? "folder",
          isDirectory: isFolderType(object.type ?? "folder"),
        })
    : undefined;

  const handleManualDropdownToggle = () => {
    setHasInteracted(true);
    setShowDropdown(!showDropdown);
    setIsManualTrigger(!showDropdown);
    setHighlightedIndex(-1);
  };

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

  React.useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [highlightedIndex]);

  const updateDropdownLayout = React.useEffectEvent(() => {
    if (!showDropdown || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const preferredHeight = 640;
    const minHeight = 288;
    const gap = 4;
    const maxHeightUpward = 360;

    let openUpward = false;
    let maxHeight = preferredHeight;

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
      const raf = requestAnimationFrame(() => {
        updateDropdownLayout();
      });
      return () => {
        cancelAnimationFrame(raf);
      };
    }
    setDropdownRect(null);
  }, [showDropdown]);

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

  const candidateObjects = isManualTrigger ? objects : filteredObjects;
  const displayObjects = filter
    ? candidateObjects.filter(filter)
    : candidateObjects;

  const previousValueRef = React.useRef<string | undefined>(value);
  // Track which value is already resolved so derivation does not rerun on every objects
  // refresh or displayName change.
  const resolvedValueRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    const valueChanged = previousValueRef.current !== value;
    if (valueChanged) previousValueRef.current = value;

    // A search not yet run has no list to look the value up in, so its name comes from the
    // path.
    if (value && (objects.length > 0 || !searchEnabled)) {
      if (valueChanged || resolvedValueRef.current !== value) {
        resolvedValueRef.current = value;
        const foundObject = objects.find((obj) => obj.path === value);
        queueMicrotask(() => {
          if (foundObject) {
            setDisplayName(foundObject.name || "");
            selectedObjectRef.current = foundObject;
          } else {
            const derivedName = value.split("/").filter(Boolean).pop() ?? value;
            setDisplayName(derivedName);
            selectedObjectRef.current = null;
            setSearchQuery("");
          }
        });
      }
    } else if (!value && valueChanged) {
      // Typing drops the selection first, so a parent that clears `value` in response must
      // not also wipe the text being typed; only an outside clear (a form reset) empties
      // the search box.
      const clearedByTyping = selectedObjectRef.current === null;
      resolvedValueRef.current = undefined;
      queueMicrotask(() => {
        setDisplayName("");
        selectedObjectRef.current = null;
        if (!clearedByTyping) setSearchQuery("");
      });
    }
  }, [value, objects, searchEnabled, setSearchQuery]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || displayObjects.length === 0) {
      if (event.key === "Enter" && selectedObjectRef.current) {
        event.preventDefault();
        // A caller without onObjectSelect already holds the pick as its value, so Enter
        // has nothing to commit and must not clear it.
        if (!onObjectSelect) return;
        onObjectSelect(selectedObjectRef.current);
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
    <>
      <WorkspaceObjectSelectorView
        id={id}
        className={className}
        placeholder={placeholder}
        validationError={validationError}
        invalid={invalid}
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
          setHasInteracted(true);
          if (searchQuery.length > 0 || isManualTrigger) setShowDropdown(true);
        }}
        onInputKeyDown={handleInputKeyDown}
        onToggleDropdown={handleManualDropdownToggle}
        onObjectClick={(object) => {
          handleObjectClick(object, !onSelectedObjectChange);
        }}
        onObjectHighlight={setHighlightedIndex}
        disabled={disabled}
        browse={
          pickerTarget
            ? {
                label:
                  pickerTarget.kind === "folder"
                    ? "Browse workspace folders"
                    : "Browse workspace files",
                disabled: disabled || !username,
                onClick: () => {
                  setHasOpenedPicker(true);
                  setIsPickerOpen(true);
                },
                onPreload: preloadFolderPickerDialog,
              }
            : null
        }
      />
      {pickerTarget && hasOpenedPicker ? (
        <WorkspaceFolderPickerDialog
          open={isPickerOpen}
          onOpenChange={setIsPickerOpen}
          target={pickerTarget}
          title={browseTitle}
          initialPath={value ?? ""}
          isSelectable={isBrowseSelectable}
          onSelect={handleBrowseSelect}
        />
      ) : null}
    </>
  );
}

export function WorkspaceObjectSelector(props: WorkspaceObjectSelectorProps) {
  return useWorkspaceObjectSelector(props);
}
