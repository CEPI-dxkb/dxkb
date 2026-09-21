import { Children, type FocusEvent } from "react";

import { cn } from "@/lib/utils";

interface LegendAppearance {
  className: string;
  style?: React.CSSProperties;
}

function legendAppearance(
  isPill: boolean,
  active: boolean,
  dimmed: boolean,
  color: string,
): LegendAppearance {
  let className = isPill
    ? "border-border text-foreground/70"
    : "text-foreground/70";
  let style: React.CSSProperties | undefined;

  if (active && !dimmed) {
    className = "text-foreground";
    style = {
      backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      ...(isPill ? { borderColor: color } : {}),
    };
  } else if (dimmed) {
    className = cn(
      isPill && "border-border",
      "text-foreground/40",
      active ? "opacity-40" : "opacity-30",
    );
    if (active) {
      style = {
        backgroundColor:
          "color-mix(in srgb, var(--foreground) 30%, transparent)",
      };
    }
  }

  return { className, style };
}

interface ChartLegendPillProps {
  label: string;
  color: string;
  active: boolean;
  dimmed?: boolean;
  variant?: "pill" | "row";
  ariaLabel?: string;
  ariaPressed?: boolean;
  children?: React.ReactNode;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onFocus?: (event: FocusEvent<HTMLButtonElement>) => void;
  onClick?: () => void;
}

export function ChartLegendPill({
  label,
  color,
  active,
  dimmed = false,
  variant = "pill",
  ariaLabel,
  ariaPressed,
  children,
  onActivate,
  onDeactivate,
  onFocus,
  onClick,
}: ChartLegendPillProps) {
  const isPill = variant === "pill";
  const typographyClass = isPill ? "text-xs" : "text-[12px]";
  const shapeClass = isPill
    ? "rounded-full border px-2 py-0.5"
    : "w-full rounded px-1.5 py-0.5";
  const appearance = legendAppearance(isPill, active, dimmed, color);

  return (
    <button
      type="button"
      aria-pressed={ariaPressed}
      aria-label={
        Children.count(children) > 0 ? undefined : (ariaLabel ?? label)
      }
      data-active={active ? "true" : undefined}
      className={cn(
        "flex cursor-default items-center gap-1.5 transition-colors",
        typographyClass,
        shapeClass,
        appearance.className,
      )}
      style={appearance.style}
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={(event) => {
        onActivate?.();
        onFocus?.(event);
      }}
      onBlur={onDeactivate}
      onClick={onClick}
    >
      <span
        className="inline-block size-2.5 shrink-0 rounded-full"
        style={{
          background: color,
          border:
            "1px solid color-mix(in srgb, var(--foreground) 70%, transparent)",
        }}
        aria-hidden="true"
      />
      {children ?? label}
    </button>
  );
}
