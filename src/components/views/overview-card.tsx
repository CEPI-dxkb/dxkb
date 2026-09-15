import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OverviewPrimitiveValue = string | number | boolean | bigint;

function isOverviewPrimitive(value: unknown): value is OverviewPrimitiveValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  );
}

/**
 * Note on array items: a non-primitive item is dropped, and so is a `null` or
 * `undefined` one. The pre-consolidation `display()` helpers rendered those
 * last two as the literal text `"null"`/`"undefined"` via a bare `String()`.
 * No schema-typed array field can hold them today, so this is unreachable
 * rather than a behaviour change, but it is a divergence worth knowing about.
 */

/**
 * JSON-serializes a plain (non-array, non-primitive) value. A result that
 * carries no content -- `undefined` (`JSON.stringify` returns that for a
 * function or `undefined` itself), `"{}"`, or `"[]"` -- is treated as no
 * serialization at all, so an empty object never renders as empty braces.
 */
function serializeOverviewObject(value: unknown): string | undefined {
  const json = JSON.stringify(value);
  return json && json !== "{}" && json !== "[]" ? json : undefined;
}

/**
 * Whether a raw overview field value has anything worth displaying.
 *
 * `0` and `false` are available. `null`, `undefined`, `""`, an empty array,
 * and an array with no primitive items are not -- an empty array must never
 * render as an empty value. A plain object is available only if it
 * serializes to non-trivial JSON (see `serializeOverviewObject`); it is
 * never stringified as the meaningless "[object Object]".
 */
export function isOverviewValueAvailable(value: unknown): boolean {
  if (value == null || value === "") return false;
  if (Array.isArray(value)) return value.some(isOverviewPrimitive);
  if (isOverviewPrimitive(value)) return true;
  return serializeOverviewObject(value) !== undefined;
}

/**
 * Formats an overview field value as display text. Arrays are joined from
 * their primitive items only -- non-primitive items (e.g. objects) are
 * dropped rather than stringified. A plain object renders as its JSON
 * serialization (real, inspectable content, unlike "[object Object]").
 * Unavailable values (see `isOverviewValueAvailable`) format as
 * "Not available"; callers that want to omit the field entirely instead of
 * showing that text should check availability themselves before rendering.
 */
export function formatOverviewValue(value: unknown): string {
  if (!isOverviewValueAvailable(value)) return "Not available";
  if (Array.isArray(value)) {
    return value.filter(isOverviewPrimitive).map(String).join(", ");
  }
  if (isOverviewPrimitive(value)) return String(value);
  return serializeOverviewObject(value) ?? "Not available";
}

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
