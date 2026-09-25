"use client";

import {
  useId,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ChevronDown, Loader2, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import { cn } from "@/lib/utils";

export function WorkspaceObjectSelectorView({
  id,
  className,
  placeholder,
  validationError,
  inputValue,
  searchQuery,
  objects,
  loading,
  error,
  showDropdown,
  highlightedIndex,
  dropdownLayout,
  listboxId,
  inputRef,
  inputElementRef,
  dropdownRef,
  itemRefs,
  onInputChange,
  onInputFocus,
  onInputKeyDown,
  onToggleDropdown,
  onObjectClick,
  onObjectHighlight,
}: WorkspaceObjectSelectorViewProps) {
  const generatedListboxId = useId();
  const resolvedListboxId = listboxId ?? generatedListboxId;
  const hasActiveOption =
    showDropdown &&
    dropdownLayout.rect !== null &&
    !loading &&
    !error &&
    highlightedIndex >= 0 &&
    highlightedIndex < objects.length;

  return (
    <div className={className ? `relative ${className}` : "relative w-full"}>
      {validationError && (
        <Alert variant="destructive" className="mb-2">
          <AlertCircle className="size-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-row items-center gap-2">
        <div ref={inputRef} className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <ServiceInput
            id={id}
            ref={inputElementRef}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={resolvedListboxId}
            aria-activedescendant={
              hasActiveOption
                ? `${resolvedListboxId}-option-${String(highlightedIndex)}`
                : undefined
            }
            placeholder={placeholder}
            value={inputValue}
            onChange={onInputChange}
            onFocus={onInputFocus}
            onKeyDown={onInputKeyDown}
            className="w-full px-10"
          />
          <Button
            type="button"
            aria-label={showDropdown ? "Hide suggestions" : "Show suggestions"}
            aria-expanded={showDropdown}
            onClick={onToggleDropdown}
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 bg-primary/15 text-primary transition-colors hover:bg-primary/25 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/80"
          >
            <ChevronDown
              className={`size-4 transition-transform ${showDropdown ? "rotate-180" : ""}`}
            />
          </Button>
          {showDropdown && (
            <WorkspaceObjectDropdown
              objects={objects}
              loading={loading}
              error={error}
              searchQuery={searchQuery}
              highlightedIndex={highlightedIndex}
              dropdownLayout={dropdownLayout}
              dropdownRef={dropdownRef}
              itemRefs={itemRefs}
              onObjectClick={onObjectClick}
              onObjectHighlight={onObjectHighlight}
              listboxId={resolvedListboxId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface DropdownLayout {
  openUpward: boolean;
  maxHeight: number;
  rect: { top: number; left: number; width: number; bottom?: number } | null;
}

interface WorkspaceObjectSelectorViewProps {
  id?: string;
  className?: string;
  placeholder: string;
  validationError: string | null;
  inputValue: string;
  searchQuery: string;
  objects: WorkspaceObject[];
  loading: boolean;
  error: string | null;
  showDropdown: boolean;
  highlightedIndex: number;
  dropdownLayout: DropdownLayout;
  listboxId?: string;
  inputRef: RefObject<HTMLDivElement | null>;
  inputElementRef: RefObject<HTMLInputElement | null>;
  dropdownRef: RefObject<HTMLDivElement | null>;
  itemRefs: RefObject<(HTMLButtonElement | null)[]>;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onInputFocus: () => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onToggleDropdown: () => void;
  onObjectClick: (object: WorkspaceObject) => void;
  onObjectHighlight: (index: number) => void;
}

function WorkspaceObjectDropdown({
  objects,
  loading,
  error,
  searchQuery,
  highlightedIndex,
  dropdownLayout,
  dropdownRef,
  itemRefs,
  onObjectClick,
  onObjectHighlight,
  listboxId,
}: Pick<
  WorkspaceObjectSelectorViewProps,
  | "objects"
  | "loading"
  | "error"
  | "searchQuery"
  | "highlightedIndex"
  | "dropdownLayout"
  | "dropdownRef"
  | "itemRefs"
  | "onObjectClick"
  | "onObjectHighlight"
> & { listboxId: string }) {
  const { rect, openUpward, maxHeight } = dropdownLayout;
  if (!rect || typeof document === "undefined") return null;

  return createPortal(
    <div
      id={listboxId}
      ref={dropdownRef}
      role="listbox"
      className="fixed z-40 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent overflow-y-auto rounded-md border bg-popover shadow-md hover:scrollbar-thumb-muted-foreground/40 dark:scrollbar-thumb-muted-foreground/30 dark:hover:scrollbar-thumb-muted-foreground/50"
      style={{
        ...(openUpward
          ? { bottom: rect.bottom, top: "auto" }
          : { top: rect.top }),
        left: rect.left,
        width: rect.width,
        maxHeight,
      }}
    >
      {error ? (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              Failed to load workspace objects: {error}
            </AlertDescription>
          </Alert>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="mr-2 size-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      ) : objects.length > 0 ? (
        objects.map((object, index) => {
          const cleanPath =
            object.path.replace(/^\/[^/]+@[^/]+/, "") ||
            object.path ||
            object.name ||
            "Unnamed Object";
          return (
            <button
              id={`${listboxId}-option-${String(index)}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={highlightedIndex === index}
              key={object.path}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between p-2 text-left hover:bg-accent",
                highlightedIndex === index && "bg-accent",
              )}
              onClick={() => {
                onObjectClick(object);
              }}
              onMouseEnter={() => {
                onObjectHighlight(index);
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {object.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {cleanPath}
                </span>
              </span>
            </button>
          );
        })
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {searchQuery
            ? "No objects found matching your search"
            : "No objects found"}
        </p>
      )}
    </div>,
    document.body,
  );
}
