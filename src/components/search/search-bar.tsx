"use client";

import { useState, Suspense, type SyntheticEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  searchHref,
  searchTypeForLocation,
  searchTypes,
} from "@/constants/search-info";
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

function SearchBarWithParams(props: SearchBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canonicalType = searchTypeForLocation(pathname, searchParams);
  const rawQuery =
    (canonicalType ? searchParams.get("keyword") : searchParams.get("q")) ||
    props.initialValue ||
    "";
  const requestedType =
    canonicalType ?? searchParams.get("type") ?? "everything";
  const initialType = searchTypes.some((type) => type.id === requestedType)
    ? requestedType
    : "everything";
  const stateKey = `${requestedType}:${rawQuery}`;
  return (
    <SearchBarForm
      key={stateKey}
      {...props}
      initialValue={extractKeywordQuery(rawQuery)}
      initialType={initialType}
    />
  );
}

export function SearchBar(props: SearchBarProps) {
  return (
    <Suspense fallback={null}>
      <SearchBarWithParams {...props} />
    </Suspense>
  );
}

function SearchBarForm({
  initialValue = "",
  initialType = "everything",
  className = "",
  placeholder = "Search by virus name, protein, gene, or taxonomy...",
  size = "default",
  showIcon = true,
}: SearchBarProps & { initialType?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [inputValue, setInputValue] = useState(initialValue);
  const [selected, setSelected] = useState(initialType);

  const handleSearch = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const searchType = searchTypes.find((type) => type.id === selected);
    if (!searchType) return;
    router.push(searchHref(searchType, inputValue));
    void queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return key === "genome-meta" || key === "genome-full";
      },
    });
  };

  return (
    <form onSubmit={handleSearch} className={`flex w-full ${className}`}>
      <div className="relative flex size-full items-stretch overflow-hidden rounded-md border border-input bg-background">
        <Select
          items={searchTypes.map((option) => ({
            value: option.id,
            label: option.typeTitle,
          }))}
          value={selected}
          onValueChange={(value) => {
            setSelected(value ?? "everything");
          }}
        >
          <SelectTrigger
            id="type"
            aria-label="Search type"
            className={`${size === "lg" ? "h-auto py-6" : ""} min-w-30 rounded-l-md rounded-r-none border-0 border-r border-input bg-background text-sm text-foreground shadow-none focus:ring-0`}
          >
            <SelectValue aria-label="Search type" />
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

        <div className="relative min-w-0 flex-1">
          <Input
            type="text"
            placeholder={placeholder}
            className={`${size === "lg" ? "py-6" : ""} ${showIcon ? "pl-10" : ""} w-full rounded-l-none rounded-r-md border-0 bg-background text-foreground shadow-none focus-visible:ring-0`}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
            }}
          />
          {showIcon && (
            <button
              type="submit"
              className="absolute top-1/2 left-3 -translate-y-1/2 transform cursor-pointer text-primary transition-colors hover:text-primary/80"
              aria-label="Search"
            >
              <Search size={18} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
