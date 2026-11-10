import { render } from "vitest-browser-react";
import type { ReactNode } from "react";
import axe from "axe-core";
import type { AxeResults, RunOptions } from "axe-core";

export type Theme = "dxkb-light" | "dxkb-dark";
export const allThemes: Theme[] = ["dxkb-light", "dxkb-dark"];

const coreAxeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;
const extraAxeTags = ["best-practice", "wcag22aa"] as const;
const allAxeTags = [...coreAxeTags, ...extraAxeTags];

const coreTags = new Set<string>(coreAxeTags);

/** Mirror of gate.ts classify() — copied here to avoid cross-dir imports. */
function isBlocking(violation: axe.Result): boolean {
  const impact = violation.impact;
  if (impact === "critical") return true;
  const isCore = violation.tags.some((t) => coreTags.has(t));
  return isCore && (impact === "moderate" || impact === "serious");
}

export interface AxeScanResult {
  blocking: axe.Result[];
  warnings: axe.Result[];
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.remove("dxkb-light", "dxkb-dark");
  document.documentElement.classList.add(theme);
}

export async function renderWithTheme(ui: ReactNode, theme: Theme = "dxkb-light") {
  applyTheme(theme);
  return render(ui);
}

export async function runAxeOnContainer(
  container: Element,
  options: RunOptions = {},
): Promise<AxeScanResult> {
  const results: AxeResults = await axe.run(container, {
    runOnly: { type: "tag", values: allAxeTags },
    ...options,
  });
  const blocking = results.violations.filter(isBlocking);
  const warnings = results.violations.filter((v) => !isBlocking(v));
  return { blocking, warnings };
}

export function formatBlockingViolations(violations: axe.Result[], context: string): string {
  const lines = violations.map((v) => {
    const targets = v.nodes
      .slice(0, 3)
      .map((n) => `      ${n.target.join(" ")}`)
      .join("\n");
    return `  - [${v.impact ?? ""}] ${v.id}: ${v.help}\n${targets}`;
  });
  return `${String(violations.length)} blocking a11y violation(s) in ${context}:\n${lines.join("\n")}`;
}
