"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  parseTheme,
  themeBases,
  themeLabels,
  type ThemeBase,
  type ThemeMode,
} from "@/styles/themes";

/**
 * The theme picker's menu items: a Light/Dark toggle above one row per theme,
 * each with a small picture of the app in that theme. Rendered inside a
 * DropdownMenuContent (signed-out navbar button) or DropdownMenuSubContent
 * (the profile dropdown's Theme submenu).
 */
export function ThemeMenuOptions() {
  const { theme, setTheme } = useTheme();
  const { base, mode } = parseTheme(theme);

  return (
    <>
      <DropdownMenuRadioGroup
        variant="segmented"
        aria-label="Color mode"
        value={mode}
        onValueChange={(next: ThemeMode) => {
          setTheme(`${base}-${next}`);
        }}
      >
        <DropdownMenuRadioItem variant="segment" value="light">
          <Sun className="size-3.5" />
          Light
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem variant="segment" value="dark">
          <Moon className="size-3.5" />
          Dark
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup
        aria-label="Theme"
        value={base}
        onValueChange={(next: ThemeBase) => {
          setTheme(`${next}-${mode}`);
        }}
      >
        {themeBases.map((option) => (
          <DropdownMenuRadioItem key={option} variant="preview" value={option}>
            <ThemePreview theme={`${option}-${mode}`} />
            {themeLabels[option]}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

/**
 * A miniature page (navbar, side rail, a heading, text lines and an accent
 * chip) painted with a theme's own tokens: setting data-theme on the wrapper
 * scopes that theme's custom properties to it, so each preview shows its real
 * colors whatever theme the page is in.
 */
function ThemePreview({ theme }: { theme: string }) {
  return (
    <span
      aria-hidden="true"
      data-theme={theme}
      className="flex h-10 w-16 shrink-0 flex-col overflow-hidden rounded-sm border bg-background"
    >
      <span className="flex h-2 shrink-0 items-center justify-end gap-0.5 bg-primary px-1">
        <span className="h-0.5 w-1.5 rounded-full bg-primary-foreground/70" />
        <span className="h-0.5 w-1.5 rounded-full bg-primary-foreground/70" />
      </span>
      <span className="flex flex-1">
        <span className="w-3 shrink-0 border-r bg-muted" />
        <span className="flex flex-1 flex-col gap-1 p-1">
          <span className="h-1 w-5 rounded-full bg-secondary" />
          <span className="h-0.5 w-full rounded-full bg-muted-foreground/40" />
          <span className="h-0.5 w-2/3 rounded-full bg-muted-foreground/40" />
          <span className="h-1 w-3 rounded-full bg-accent" />
        </span>
      </span>
    </span>
  );
}
