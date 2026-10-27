"use client";

/**
 * The Compare Region Viewer's legend, on one line under the figure: what
 * the ribbons mean, the glyph key and that zooming reveals more. Its glyphs
 * are always Comfortable's, whatever the figure's density.
 */
import { ZoomIn } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  deepen,
  familyColor,
  focusFamilyColor,
  identityColor,
} from "@/lib/compare-region/colors";
import { densitySpecs } from "@/lib/compare-region/density";
import { arrowPath, barPath } from "@/lib/compare-region/glyph-paths";

const legendSpec = densitySpecs.comfortable;

function LegendItem({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <svg
        width={26}
        height={14}
        aria-hidden
        className="shrink-0 overflow-visible"
      >
        {children}
      </svg>
      {label}
    </span>
  );
}

/** Whether `ref`'s element is wider than its box, measured again whenever its box changes. */
function useScrollsSideways(ref: RefObject<HTMLElement | null>): boolean {
  const [scrolls, setScrolls] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      setScrolls(element.scrollWidth > element.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return scrolls;
}

/**
 * One compact line: what ribbons mean, the shape key, and that zooming
 * reveals more. Under `md` the line scrolls sideways, and then the legend
 * takes focus, so a keyboard can scroll it too; where it wraps (or fits) it
 * is no tab stop.
 */
export function Legend() {
  const ref = useRef<HTMLDivElement>(null);
  const scrolls = useScrollsSideways(ref);
  return (
    <div
      ref={ref}
      role="group"
      aria-label="Legend"
      tabIndex={scrolls ? 0 : undefined}
      className="flex shrink-0 items-center gap-x-2.5 gap-y-1.5 overflow-x-auto border-t px-4 py-2 text-2xs whitespace-nowrap text-foreground/70 md:flex-wrap">
      <span
        title="Ribbons join the genes of families found in at least half the genomes at 1×, and of rarer families as you zoom in"
        className="flex shrink-0 items-center gap-1.5 text-foreground"
      >
        <svg width={28} height={18} aria-hidden className="shrink-0">
          <path
            d="M3,6 C3,9 13,9 13,12 L27,12 C27,9 17,9 17,6Z"
            fill={familyColor(4)}
            fillOpacity={0.3}
          />
          <path d={arrowPath(legendSpec, 3, 17, 0, 6)} fill={familyColor(4)} />
          <path
            d={arrowPath(legendSpec, 13, 27, 12, 6)}
            fill={familyColor(4)}
          />
        </svg>
        Shared by most genomes
      </span>
      <span aria-hidden className="hidden h-3.5 w-px bg-border md:block" />
      <LegendItem label="Focus family">
        <path
          d={arrowPath(legendSpec, 1, 25, 1, 12)}
          fill={focusFamilyColor}
          stroke={deepen(focusFamilyColor)}
          strokeWidth={1.5}
        />
      </LegendItem>
      <LegendItem label="By family">
        <path
          d={arrowPath(legendSpec, 1, 13, 1, 12)}
          fill={familyColor(5)}
          className="stroke-card"
        />
        <path
          d={arrowPath(legendSpec, 13, 25, 1, 12)}
          fill={familyColor(3)}
          className="stroke-card"
        />
      </LegendItem>
      <LegendItem label="In one genome">
        <path
          d={arrowPath(legendSpec, 1, 25, 1, 12)}
          fill={familyColor(7)}
          className="stroke-card opacity-45 dark:opacity-35"
        />
      </LegendItem>
      <LegendItem label="No family">
        <path
          d={arrowPath(legendSpec, 1, 25, 1, 12)}
          className="fill-muted-foreground/20 dark:fill-muted-foreground/25"
        />
      </LegendItem>
      <LegendItem label="Pseudogene">
        <path
          d={arrowPath(legendSpec, 1, 25, 2, 10)}
          className="fill-muted-foreground/10 stroke-foreground/55"
          strokeDasharray={legendSpec.pseudoDash}
        />
      </LegendItem>
      <LegendItem label="BLAST identity">
        <path d={barPath(1, 9, 4.5, 5, 2.5)} fill={identityColor(30)} />
        <path d={barPath(9, 17, 4.5, 5, 2.5)} fill={identityColor(65)} />
        <path d={barPath(17, 25, 4.5, 5, 2.5)} fill={identityColor(100)} />
      </LegendItem>
      <LegendItem label="RNA, other">
        <path
          d={barPath(5, 21, 3, 8, 2)}
          className="fill-muted-foreground/40"
        />
      </LegendItem>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <ZoomIn className="size-3.5" />
        Zoom in for names, more ribbons
      </span>
    </div>
  );
}
