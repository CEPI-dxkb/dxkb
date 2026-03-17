"use client";

import React, { useState, FormEvent, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { searchTypes } from "@/constants/searchInfo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { Search, X } from "lucide-react";

interface MobileSearchBarProps {
  initialValue?: string;
  className?: string;
  placeholder?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

function extractKeywordQuery(raw: string): string {
  const matches = [...raw.matchAll(/keyword\(([^)]+)\)/g)];
  const keywords = matches.map((match) => match[1]);
  return keywords.join(" ");
}

function SearchParamsSync({
  onQueryChange,
}: {
  onQueryChange: (value: string) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const raw = searchParams.get("q") || "";
    onQueryChange(extractKeywordQuery(raw));
  }, [searchParams, onQueryChange]);

  return null;
}

function MobileSearchBarContent({
  initialValue = "",
  className = "",
  placeholder = "Search by virus name, protein, gene, or taxonomy...",
  isOpen = true,
  onClose: _onClose,
}: MobileSearchBarProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [selected, setSelected] = useState("everything");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    router.push(
      `/buildsearch?q=${encodeURIComponent(inputValue)}&searchtype=${selected}`,
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClear = () => {
    setInputValue("");
    inputRef.current?.focus();
  };

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setIsPopoverOpen(false);
    }
  }

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleQueryChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const selectedType =
    searchTypes.find((type) => type.id === selected) || searchTypes[0];

  return (
    <form onSubmit={handleSearch} className={cn("flex w-full", className)}>
      <Suspense fallback={null}>
        <SearchParamsSync onQueryChange={handleQueryChange} />
      </Suspense>
      <div className="bg-muted/80 dark:bg-muted/60 border-muted-foreground/30 relative flex w-full items-center overflow-hidden rounded-full border">
        {/* Data Types Selector - Left Side */}
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                size="sm"
                className="text-foreground bg-background hover:bg-muted/60 border-muted-foreground/30 h-10 shrink-0 rounded-none rounded-l-full border-0 border-r px-3 text-xs font-medium whitespace-nowrap"
              >
                {selectedType.typeTitle}
              </Button>
            }
          />
          <PopoverContent
            className="z-50 w-56 p-1"
            align="start"
            side="bottom"
            sideOffset={8}
          >
            <div
              className="[&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/40 dark:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 dark:[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50 max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor:
                  "hsl(var(--muted-foreground) / 0.2) transparent",
              }}
            >
              {searchTypes.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelected(option.id);
                    setIsPopoverOpen(false);
                  }}
                  className={cn(
                    "w-full rounded-sm px-3 py-2 text-left text-sm transition-colors",
                    selected === option.id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {option.typeTitle}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Input Field Container */}
        <div className="relative min-w-0 flex-1">
          {/* Search Icon */}
          <Search
            className="text-primary pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2"
            size={18}
          />

          {/* Input Field */}
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            className="text-foreground bg-background placeholder:text-muted-foreground h-10 rounded-none rounded-r-full border-0 pr-9 pl-10 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* Clear Button - Only clears input, does not close search bar */}
          {inputValue && (
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClear();
              }}
              className="text-muted-foreground hover:bg-muted/80 hover:text-foreground absolute top-1/2 right-2 z-30 flex h-7 w-7 -translate-y-1/2 cursor-pointer touch-manipulation items-center justify-center rounded-full transition-colors"
              aria-label="Clear search"
            >
              <X size={18} />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

export function MobileSearchBar(props: MobileSearchBarProps) {
  if (!props.isOpen) {
    return null;
  }

  return (
    <MobileSearchBarContent {...props} />
  );
}
