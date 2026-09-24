"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Palette, Check } from "lucide-react";
import { themeBases } from "@/styles/themes";
import { useIsMounted } from "@/hooks/use-is-mounted";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const themePrimary: Record<string, string> = {
  zinc:   "#18181b",
  orange: "#c2410c",
  violet: "#6d28d9",
  dxkb:   "#FF7248",
  bvbrc:  "#008C81",
};

const themeLabel: Record<string, string> = {
  zinc:   "Zinc",
  orange: "Orange",
  violet: "Violet",
  dxkb:   "DXKB",
  bvbrc:  "BV-BRC",
};

export function NavbarThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const isMounted = useIsMounted();
  const [open, setOpen] = useState(false);

  if (!isMounted) return null;

  const currentTheme = theme ?? "dxkb-light";
  const dashIdx = currentTheme.lastIndexOf("-");
  const parsedBase = dashIdx > 0 ? currentTheme.slice(0, dashIdx) : "";
  const parsedMode = dashIdx > 0 ? currentTheme.slice(dashIdx + 1) : "";
  const currentBase = themeBases.includes(parsedBase) ? parsedBase : "zinc";
  const currentMode: "light" | "dark" = parsedMode === "dark" ? "dark" : "light";
  const isDark = currentMode === "dark";

  const setBase = (base: string) => { setTheme(`${base}-${currentMode}`); };
  const toggleMode = (mode: "light" | "dark") => {
    if (mode !== currentMode) setTheme(`${currentBase}-${mode}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            aria-label="Open theme selector"
            className={cn(
              "relative flex size-8 items-center justify-center rounded-full border transition-all duration-200",
              "border-white/30 text-white/80 hover:border-white hover:bg-white/10 hover:text-white",
              open && "border-white bg-white/15 text-white",
            )}
          >
            <Palette className="size-4" />
          </button>
        }
      />
      <PopoverContent
        className="w-52 gap-0 p-0 shadow-lg"
        align="end"
        side="bottom"
        sideOffset={8}
      >
        {/* Mode toggle — shadcn Tabs pattern */}
        <div className="p-2 pb-1">
          <div className="flex rounded-md bg-muted p-0.5">
            <button
              onClick={() => { toggleMode("light"); }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-all duration-150",
                !isDark
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sun className="size-3.5" />
              Light
            </button>
            <button
              onClick={() => { toggleMode("dark"); }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-all duration-150",
                isDark
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Moon className="size-3.5" />
              Dark
            </button>
          </div>
        </div>

        {/* Theme list */}
        <div className="px-2 pt-0 pb-1">
          {themeBases.map((base, i) => {
            const isSelected = currentBase === base;
            return (
              <button
                key={base}
                onClick={() => { setBase(base); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <span className="w-4 shrink-0 text-xs text-muted-foreground/40">{i + 1}</span>
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: themePrimary[base] }}
                />
                <span className="flex-1 text-left">{themeLabel[base] ?? base}</span>
                {/* fixed-width slot keeps name centered regardless of selection */}
                <span className="w-4 shrink-0">
                  <Check className={cn("size-3.5", isSelected ? "opacity-100" : "opacity-0")} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t px-3 py-1">
          <p className="text-2xs text-muted-foreground/60">
            {themeLabel[currentBase] ?? currentBase} · {currentMode}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
