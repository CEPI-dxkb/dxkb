import type { ReactNode } from "react";

interface MetaCatsInputSectionProps {
  active: boolean;
  /**
   * The parent is a flex column with `gap-6`, where margins add to the gap. The
   * default keeps the 40px offset the Feature Groups and Alignment Files
   * sections have always rendered with; Auto Grouping passes `"space-y-4"` to
   * keep its 24px offset. Do not normalise the two — that is a visual decision.
   */
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
