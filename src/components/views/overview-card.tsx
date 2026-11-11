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
  value?: unknown;
  available?: boolean;
  className?: string;
  children?: ReactNode;
}

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
