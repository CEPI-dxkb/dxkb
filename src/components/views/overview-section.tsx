import type { ReactNode } from "react";
import { OverviewCard, OverviewField } from "./overview-card";
import { isOverviewValueAvailable } from "./overview-value-policy";

export interface OverviewSectionField {
  /**
   * Stable React key for the field. Defaults to `label`, which is unique
   * within a section; pass the source field name where one exists.
   */
  field?: string;
  label: string;
  /** Raw value used to derive availability and, absent `children`, display text. */
  value?: unknown;
  /**
   * Overrides the value-based availability check, for a field whose visibility
   * depends on entity-specific logic (a recognized ID shape, a resolved link
   * list) rather than the raw value alone.
   */
  available?: boolean;
  /** Overrides the default `<dd>` className for entity-specific layouts. */
  className?: string;
  /** Custom `<dd>` content (e.g. a link) instead of the formatted value. */
  children?: ReactNode;
}

/**
 * Whether a section field will render. Delegates to the same
 * `isOverviewValueAvailable` primitive `OverviewField` uses, so there is one
 * set of availability rules rather than two that could drift.
 */
function sectionFieldAvailable(field: OverviewSectionField): boolean {
  return field.available ?? isOverviewValueAvailable(field.value);
}

export interface OverviewSectionProps {
  title: string;
  /** Display order is this array's order. */
  fields: readonly OverviewSectionField[];
}

/**
 * One titled entity-overview section, rendered from an ordered field list.
 *
 * Presentation only — it holds no knowledge of any entity, field map or
 * schema. Callers keep their own hand-written, ordered field lists; this
 * component owns two things those lists kept getting wrong:
 *
 * 1. **Unavailable fields are filtered before rendering, not during it.**
 *    `OverviewField` already returns `null` for an unavailable field, which is
 *    enough to prevent an empty `<dd>` but not enough to tell the section it
 *    has nothing left to show. Filtering first makes the section's emptiness
 *    knowable, and the surviving fields are then rendered with `available`
 *    forced, so a non-empty `<dl>` can never render as empty.
 * 2. **One empty-section policy for every overview.** When no field survives
 *    the filter, the card keeps its title and renders the shared
 *    "No data available." paragraph. This is the project-wide choice, made
 *    once here instead of per entity by accident: a titled card around an
 *    empty `<dl>` is the defect being fixed, and a section that is present but
 *    unpopulated is itself information (the entity has that category of data,
 *    and none of it), so the card stays rather than disappearing.
 */
export function OverviewSection({ title, fields }: OverviewSectionProps) {
  const availableFields = fields.filter(sectionFieldAvailable);
  return (
    <OverviewCard title={title}>
      {availableFields.length > 0 ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          {availableFields.map((field) => (
            <OverviewField
              key={field.field ?? field.label}
              label={field.label}
              value={field.value}
              available
              className={field.className}
            >
              {field.children}
            </OverviewField>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">No data available.</p>
      )}
    </OverviewCard>
  );
}
