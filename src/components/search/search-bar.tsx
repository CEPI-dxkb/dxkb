"use client";

import React, { useState, FormEvent, useEffect, useCallback, Suspense } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LuSearch } from "react-icons/lu";
import { useRouter, useSearchParams } from "next/navigation";
import { searchTypes } from "../../constants/searchInfo";
import { useQueryClient } from "@tanstack/react-query";

interface SearchBarProps {
  initialValue?: string;
  className?: string;
  placeholder?: string;
  size?: "default" | "lg";
  showIcon?: boolean;
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

function SearchBarContent({
  initialValue = "",
  className = "",
  placeholder = "Search by virus name, protein, gene, or taxonomy...",
  size = "default",
  showIcon = true,
}: SearchBarProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [inputValue, setInputValue] = useState(initialValue);
  const [selected, setSelected] = useState("everything");

  const handleQueryChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleSearch = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    router.push(
      `/search?q=${encodeURIComponent(inputValue)}&searchtype=${selected}`
    );
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          key === "genome-meta" ||
          key === "genome-full"
        );
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <form onSubmit={handleSearch} className={`flex w-full max-w-[880px] ${className}`}>
      <Suspense fallback={null}>
        <SearchParamsSync onQueryChange={handleQueryChange} />
      </Suspense>
      <div className="relative flex w-full h-full items-stretch rounded-md border border-input bg-background overflow-hidden">
        <Select
          items={searchTypes.map((option) => ({ value: option.id, label: option.typeTitle }))}
          value={selected}
          onValueChange={(value) => setSelected(value ?? "everything")}
        >
          <SelectTrigger
            id="searchtype"
            className={`${size === "lg" ? "h-auto py-6" : ""} text-sm min-w-[120px] rounded-l-md rounded-r-none border-0 border-r border-input bg-background text-foreground shadow-none focus:ring-0`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {searchTypes.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.typeTitle}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-0">
          <Input
            type="text"
            placeholder={placeholder}
            className={`${size === "lg" ? "py-6" : ""} ${showIcon ? "pl-10" : ""} rounded-l-none rounded-r-md border-0 bg-background text-foreground shadow-none focus-visible:ring-0 w-full`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {showIcon && (
            <LuSearch
              className="absolute top-1/2 left-3 -translate-y-1/2 transform text-primary pointer-events-none"
              size={18}
            />
          )}
        </div>
      </div>
    </form>
  );
}

export function SearchBar(props: SearchBarProps) {
  return (
    <SearchBarContent {...props} />
  );
}
