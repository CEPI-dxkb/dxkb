"use client";

import React, { useState, FormEvent, useEffect, Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LuSearch } from "react-icons/lu";
import { useRouter, useSearchParams } from "next/navigation";
import { searchTypes } from "../../constants/searchInfo";

interface SearchBarProps {
  initialValue?: string;
  className?: string;
  placeholder?: string;
  size?: "default" | "lg";
  showIcon?: boolean;
}

function SearchBarContent({
  initialValue = "",
  className = "",
  placeholder = "Search by virus name, protein, gene, or taxonomy...",
  size = "default",
  showIcon = true,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") || "";

  // Initialize inputValue with initialValue if provided, otherwise URL q
  const [inputValue, setInputValue] = useState(initialValue || urlQ);

  // Sync inputValue whenever URL q changes
  useEffect(() => {
    if (!urlQ) return; // skip if no q

    // Only update inputValue if it's different from URL (prevents overwriting typing)
    if (urlQ !== inputValue) {
      // Extract keyword(...) matches if any
      const matches = [...urlQ.matchAll(/keyword\(([^)]+)\)/g)];
      const keywords = matches.map((match) => match[1]);
      setInputValue(keywords.join(" ") || urlQ);
    }
  }, [urlQ]);

  const handleSearch = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    router.push(
      `/search?q=${encodeURIComponent(inputValue)}&searchtype=${selected}`
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const [selected, setSelected] = useState("everything");
  const [selectedTitle, setSelectedTitle] = useState("All Data Types");

  const handleSelect = (val: string, title: string) => {
    setSelected(val);
    setSelectedTitle(title);
  };

  useEffect(() => {
    const raw = searchParams.get('q') || ''

    // Match all keyword(...) values, even if nested
    const matches = [...raw.matchAll(/keyword\(([^)]+)\)/g)]
    const keywords = matches.map(match => match[1])

    // Join with space (or comma if preferred)
    setInputValue(keywords.join(' '))
  }, [searchParams])

  return (
    <form onSubmit={handleSearch} className={`flex gap-4 ${className}`}>
      <div className="relative grow">
        <Input
          type="text"
          placeholder={placeholder}
          className={`${
            size === "lg" ? "py-6" : ""
          } ${showIcon ? "pl-10" : ""} bg-background text-foreground`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {showIcon && (
          <LuSearch
            className="absolute top-1/2 left-3 -translate-y-1/2 transform text-primary"
            size={18}
          />
        )}
      </div>

      <select
        id="searchtype"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className={`${
          size === "lg" ? "py-2" : ""
        } ${showIcon ? "pl-4" : ""} bg-background rounded-md text-foreground`}
      >
        {searchTypes.map((option) => (
          <option key={option.id} value={option.id}>
            {option.typeTitle}
          </option>
        ))}
      </select>

      <Button
        type="submit"
        size={size}
        className={`bg-secondary text-primary hover:bg-secondary-foreground ${
          size === "lg" ? "py-6" : ""
        }`}
      >
        Search
      </Button>
    </form>
  );
}

export function SearchBar(props: SearchBarProps) {
  return (
    <Suspense fallback={
      <form className={`flex gap-4 ${props.className || ""}`}>
        <div className="relative grow">
          <Input
            type="text"
            placeholder={props.placeholder || "Search by virus name, protein, gene, or taxonomy..."}
            className={`${props.size === "lg" ? "py-6" : ""} ${props.showIcon !== false ? "pl-10" : ""} bg-background text-foreground`}
            disabled
          />
          {props.showIcon !== false && (
            <LuSearch
              className="absolute top-1/2 left-3 -translate-y-1/2 transform text-primary"
              size={18}
            />
          )}
        </div>
        <select
          id="searchtype"
          className={`${props.size === "lg" ? "py-2" : ""} ${props.showIcon !== false ? "pl-4" : ""} bg-background rounded-md text-foreground`}
          disabled
        >
          {searchTypes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.typeTitle}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          size={props.size}
          className={`bg-secondary hover:bg-secondary-foreground text-foreground ${
            props.size === "lg" ? "py-6" : ""
          }`}
          disabled
        >
          Search
        </Button>
      </form>
    }>
      <SearchBarContent {...props} />
    </Suspense>
  );
}
