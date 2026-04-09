"use client";

import { useState, FormEvent, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchTypes } from "@/constants/searchInfo";
import { Input } from "@/components/ui/input";

import { Search } from "lucide-react";

interface SearchBarProps {
  initialValue?: string;
  className?: string;
  placeholder?: string;
  size?: "default" | "lg";
  showIcon?: boolean;
}

function extractKeywordQuery(raw: string): string {
  const matches = [...raw.matchAll(/keyword\(([^)]+)\)/g)];
  if (matches.length === 0) return raw;
  return matches.map((match) => match[1]).join(" ");
}

function SearchParamsSync({
  onQueryChange,
  onSearchTypeChange,
}: {
  onQueryChange: (value: string) => void;
  onSearchTypeChange: (value: string) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const raw = searchParams.get("q") || "";
    onQueryChange(extractKeywordQuery(raw));
    const type = searchParams.get("searchtype") || "";
    if (type && searchTypes.some((st) => st.id === type)) onSearchTypeChange(type);
  }, [searchParams, onQueryChange, onSearchTypeChange]);

  return null;
}

export function SearchBar({
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

  const handleSearchTypeChange = useCallback((value: string) => {
    setSelected(value);
  }, []);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
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

  return (
    <form onSubmit={handleSearch} className={`flex w-full ${className}`}>
      <Suspense fallback={null}>
        <SearchParamsSync onQueryChange={handleQueryChange} onSearchTypeChange={handleSearchTypeChange} />
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
          />
          {showIcon && (
            <Search
              className="absolute top-1/2 left-3 -translate-y-1/2 transform text-primary pointer-events-none"
              size={18}
            />
          )}
        </div>
        <button type="submit" className="sr-only">Search</button>
      </div>
    </form>
  );
}
