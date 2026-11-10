import type { ReactNode } from "react";

interface MetaCatsInputSectionProps {
  active: boolean;
  /** Margins add to the parent's `gap-6`; Auto Grouping passes "space-y-4" for its 24px offset. Do not normalise the two. */
  className?: string;
  children: ReactNode;
}

export function MetaCatsInputSection({
  active,
  className = "mt-4 space-y-4",
  children,
}: MetaCatsInputSectionProps) {
  return active ? <div className={className}>{children}</div> : null;
}
