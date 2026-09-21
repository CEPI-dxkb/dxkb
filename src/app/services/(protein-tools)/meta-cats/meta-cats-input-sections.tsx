import type { ReactNode } from "react";

interface MetaCatsInputSectionProps {
  active: boolean;
  children: ReactNode;
}

export function MetaCatsAutoGroupingSection({
  active,
  children,
}: MetaCatsInputSectionProps) {
  return active ? <div className="space-y-4">{children}</div> : null;
}

export function MetaCatsFeatureGroupsSection({
  active,
  children,
}: MetaCatsInputSectionProps) {
  return active ? <div className="mt-4 space-y-4">{children}</div> : null;
}

export function MetaCatsAlignmentFilesSection({
  active,
  children,
}: MetaCatsInputSectionProps) {
  return active ? <div className="mt-4 space-y-4">{children}</div> : null;
}
