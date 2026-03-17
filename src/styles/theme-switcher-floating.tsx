"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Palette } from "lucide-react";
import { themeBases } from "@/styles/themes";
import { useIsMounted } from "@/hooks/use-is-mounted";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const isMounted = useIsMounted();

  if (!isMounted) return null;

  // Extract current theme base and mode
  const currentTheme = theme || "zinc-light";
  const [currentBase, currentMode] = currentTheme.split("-");

  const handleThemeChange = (base: string) => {
    const newTheme = `${base}-${currentMode}`;
    setTheme(newTheme);
  };

  const handleModeToggle = () => {
    const newMode = currentMode === "light" ? "dark" : "light";
    const newTheme = `${currentBase}-${newMode}`;
    setTheme(newTheme);
  };

  return (
    <div className="fixed right-6 bottom-6 z-50">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="default"
              size="icon"
              className="bg-primary hover:bg-foreground border border-accent h-12 w-12 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl"
              onClick={() => setIsOpen(!isOpen)}
            >
              <Palette className="h-5 w-5" />
            </Button>
          }
        />
        <PopoverContent
          className="w-40 p-4"
          align="end"
          side="top"
          sideOffset={8}
        >
          <div className="space-y-4">
            {/* Theme Selection */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Theme</h4>
              <div className="flex flex-col gap-2">
                {themeBases.map((base) => (
                  <Button
                    key={base}
                    variant={currentBase === base ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleThemeChange(base)}
                    className="capitalize"
                  >
                    {base}
                  </Button>
                ))}
              </div>
            </div>

            {/* Mode Toggle */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Mode</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleModeToggle}
                className="w-full justify-center"
              >
                {currentMode === "light" ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                  </>
                )}
              </Button>
            </div>

            {/* Current Theme Display */}
            <div className="border-t pt-2">
              <p className="text-muted-foreground text-xs">
                Current:{" "}
                <span className="font-medium capitalize">
                  {currentBase} {currentMode}
                </span>
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
