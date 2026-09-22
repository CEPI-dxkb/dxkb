import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatOverviewValue,
  isOverviewValueAvailable,
} from "./overview-value-policy";

export interface OverviewCardProps {
  title: string;
  children: ReactNode;
}

/** Card shell for an entity overview section: title header plus body content. */
export function OverviewCard({ title, children }: OverviewCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export interface OverviewFieldProps {
  label: string;
  /** Raw value used to derive availability and, absent `children`, display text. */
  value?: unknown;
  /** Overrides the value-based availability check, e.g. for a field whose visibility depends on entity-specific logic (a recognized ID shape) rather than the raw value alone. */
  available?: boolean;
  /** Overrides the default `<dd>` className for entity-specific layouts (e.g. wrapped link lists). */
  className?: string;
  /** Custom content for the `<dd>` (e.g. a link) instead of the formatted value. */
  children?: ReactNode;
}

/**
 * A single definition-list field/value pair (`<dt>`/`<dd>`). Renders
 * nothing when the field is unavailable, so callers never end up with an
 * empty `<dd>` under a populated `<dt>`.
 */
export function OverviewField({
  label,
  value,
  available,
  className = "mt-0.5 wrap-break-word",
  children,
}: OverviewFieldProps) {
  const fieldAvailable = available ?? isOverviewValueAvailable(value);
  if (!fieldAvailable) return null;
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className={className}>{children ?? formatOverviewValue(value)}</dd>
    </div>
  );
}
