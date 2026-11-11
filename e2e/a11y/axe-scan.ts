import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Violation } from "./gate";

// WCAG 2.1AA (blocking tier) + best-practice + 2.2AA (warn tier);
// experimental excluded.
export const coreTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
export const extraTags = ["best-practice", "wcag22aa"];
export const allAxeTags = [...coreTags, ...extraTags];

/**
 * Vendor subtrees excluded from every scan; their wrapper must still carry an
 * accessible name (tested separately).
 */
export const vendorExclusions = [
  "[data-molstar-viewer]",
  ".cm-editor",
  "[data-testid='visx-chart'] svg",
  "[data-testid='recharts-wrapper'] svg",
];

export interface ScanOptions {
  include?: string;
  exclude?: string[];
  tags?: string[];
  /** Prefer baseline suppression; use only for rules that cannot run at all. */
  disableRules?: string[];
}

export async function scanPage(page: Page, options: ScanOptions = {}): Promise<Violation[]> {
  let builder = [...vendorExclusions, ...(options.exclude ?? [])].reduce(
    (b, sel) => b.exclude(sel),
    new AxeBuilder({ page }).withTags(options.tags ?? allAxeTags),
  );

  if (options.include) builder = builder.include(options.include);
  if (options.disableRules?.length) builder = builder.disableRules(options.disableRules);

  const results = await builder.analyze();
  return results.violations;
}

export function formatBlocking(violations: Violation[], context: string): string {
  const lines = violations.map((v) => {
    const targets = v.nodes
      .slice(0, 3)
      .map((n) => `      ${n.target.join(" ")}`)
      .join("\n");
    return `  - [${v.impact ?? ""}] ${v.id}: ${v.help}\n${targets}`;
  });
  return `${String(violations.length)} blocking a11y violation(s) on ${context}:\n${lines.join("\n")}`;
}

export function logWarnings(warnings: Violation[], context: string): void {
  if (warnings.length === 0) return;
  const summary = warnings
    .map(
      (v) =>
        `  - [${v.impact ?? "minor"}] ${v.id}: ${v.help} (${String(v.nodes.length)} node${v.nodes.length === 1 ? "" : "s"})`,
    )
    .join("\n");
  console.warn(`[a11y] ${context}: ${String(warnings.length)} warn-tier violation(s):\n${summary}`);
}
