import type { Violation } from "./gate";

export interface ReflowSkipEntry {
  /** Required ticket reference for the reflow fix. */
  ticket: string;
}

export type ReflowSkipMap = Partial<Record<string, ReflowSkipEntry>>;

export function isReflowSkipped(skipMap: ReflowSkipMap, routeName: string): boolean {
  return routeName in skipMap;
}

export interface BaselineEntry {
  /** Maximum allowed node count — more nodes than this → still blocks. */
  maxNodes: number;
  /**
   * Required ticket reference, e.g. "DXKBCORE-133". Un-ticketed entries fail
   * baseline-lint.
   */
  ticket: string;
  /**
   * ISO date after which this entry auto-expires and violations block again.
   */
  expires?: string;
}

/**
 * The "*" route key applies to every route lacking a more specific entry for
 * the same theme + rule.
 */
export type BaselineMap = Partial<
  Record<string, Partial<Record<string, Record<string, BaselineEntry>>>>
>;

/** Critical violations may never be baselined. */
export function canBaseline(violation: Violation): boolean {
  return violation.impact !== "critical";
}

function lookupEntry(
  baseline: BaselineMap,
  route: string,
  theme: string,
  ruleId: string,
): BaselineEntry | undefined {
  return baseline[route]?.[theme]?.[ruleId] ?? baseline["*"]?.[theme]?.[ruleId];
}

export function isBaselined(
  baseline: BaselineMap,
  route: string,
  theme: string,
  violation: Violation,
): boolean {
  if (!canBaseline(violation)) return false;
  const entry = lookupEntry(baseline, route, theme, violation.id);
  if (!entry) return false;
  if (entry.expires && new Date(entry.expires) < new Date()) {
    console.warn(
      `[a11y/baseline] expired: ${route}/${theme}/${violation.id} (${entry.ticket}) — treating as un-baselined`,
    );
    return false;
  }
  return violation.nodes.length <= entry.maxNodes;
}

export function applyBaseline(
  baseline: BaselineMap,
  route: string,
  theme: string,
  blocking: Violation[],
): { suppressed: Violation[]; remaining: Violation[] } {
  const suppressed: Violation[] = [];
  const remaining: Violation[] = [];
  for (const v of blocking) {
    if (isBaselined(baseline, route, theme, v)) {
      suppressed.push(v);
    } else {
      remaining.push(v);
    }
  }
  return { suppressed, remaining };
}
