import type { ReactNode } from "react";
import { OverviewCard, OverviewField } from "./overview-card";
import { isOverviewValueAvailable } from "./overview-value-policy";

export interface OverviewSectionField {
  field?: string;
  label: string;
  value?: unknown;
  available?: boolean;
  className?: string;
  children?: ReactNode;
}

function sectionFieldAvailable(field: OverviewSectionField): boolean {
  return field.available ?? isOverviewValueAvailable(field.value);
}

export interface OverviewSectionProps {
  title: string;
  fields: readonly OverviewSectionField[];
}

/**
 * Unavailable fields are filtered before rendering so emptiness is knowable; an
 * empty section keeps its title and shows "No data available."
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
