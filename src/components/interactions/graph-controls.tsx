"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronUp, MousePointerClick } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Control {
  /** One chip per entry, drawn with a "+" between them. */
  keys: string[];
  action: string;
}

// What the canvas answers to. Sigma pans on drag and zooms on scroll or pinch by default; the
// click gestures are the ones `GraphEvents` in `sigma/sigma-canvas.tsx` handles.
const controls: Control[] = [
  { keys: ["Click"], action: "Highlight neighbors" },
  { keys: ["⌘/Ctrl", "Click"], action: "Add or remove" },
  { keys: ["Click empty space"], action: "Clear selection" },
  { keys: ["Drag"], action: "Pan" },
  { keys: ["Scroll"], action: "Zoom" },
];

/**
 * The canvas gestures, behind a "Controls" button at the canvas's bottom-left so they cost no space
 * until asked for. The button stays put and the list opens above it. Render inside a `relative`
 * canvas wrapper.
 */
export function GraphControls() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div
      className="absolute bottom-3 left-3 z-10 flex flex-col overflow-hidden rounded-lg border bg-background/95 shadow-sm backdrop-blur-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <div id={panelId} hidden={!open} className="w-72 border-b p-3">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-xs">
          {controls.map((control) => (
            <div key={control.action} className="contents">
              <dt className="flex items-center gap-1">
                {control.keys.map((key, index) => (
                  <Keys key={key} withPlus={index > 0}>
                    {key}
                  </Keys>
                ))}
              </dt>
              <dd className="text-muted-foreground">{control.action}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full justify-start"
        onClick={() => {
          setOpen(!open);
        }}
      >
        <MousePointerClick aria-hidden />
        Controls
        <ChevronUp
          aria-hidden
          className={open ? "ml-auto rotate-180" : "ml-auto"}
        />
      </Button>
    </div>
  );
}

function Keys({
  children,
  withPlus,
}: {
  children: ReactNode;
  withPlus: boolean;
}) {
  return (
    <>
      {withPlus && <span aria-hidden="true">+</span>}
      <kbd className="flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-mono text-2xs whitespace-nowrap text-foreground/80">
        {children}
      </kbd>
    </>
  );
}
