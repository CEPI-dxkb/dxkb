"use client";

import React from "react";
import { useTheme } from "next-themes";
import { getThemeContent, type ContentType } from "@/styles/theme-content";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface ThemeContentProps {
  type: ContentType;
  className?: string;
  as?: React.ElementType;
}

export function ThemeContent({
  type,
  className,
  as: Component = "span",
}: ThemeContentProps) {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, always use the default theme
  // This prevents hydration mismatch
  const currentTheme = mounted ? theme : "dxkb-light";
  const content = getThemeContent(currentTheme || "dxkb-light", type);

  if (!mounted) {
    return (
      <Skeleton className="w-3xl h-8 mx-auto justify-center items-center" aria-label="Content loading" />
    );
  }

  return (
    <Component className={className}>
      {content}
    </Component>
  );
}

export default ThemeContent;