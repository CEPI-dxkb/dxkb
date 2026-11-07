import type { ReactNode } from "react";
import { familyColor } from "@/lib/compare-region/colors";
import type { ChartModel, Ribbon } from "@/lib/compare-region/families";
import { ribbonKey, ribbonPath } from "@/lib/compare-region/ribbons";

/**
 * One family-colored band per ribbon, under the zoom's scale `x` (none for a
 * ribbon more than `reach` px off the plot): the trace's bridges and ribbons,
 * and Comfortable's resting ribbons.
 */
export function ribbonPaths(
  model: ChartModel,
  ribbons: readonly Ribbon[],
  x: (offset: number) => number,
  plotWidth: number,
  reach: number,
): ReactNode[] {
  return ribbons.map((ribbon) => {
    const d = ribbonPath(
      model.spec,
      model.layout,
      model.frame,
      ribbon,
      x,
      plotWidth,
      reach,
    );
    return d ? (
      <path key={ribbonKey(ribbon)} d={d} fill={familyColor(ribbon.family)} />
    ) : null;
  });
}
