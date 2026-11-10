export type Impact = "minor" | "moderate" | "serious" | "critical";
export type GateDecision = "block" | "warn";

export interface Violation {
  id: string;
  impact?: string | null;
  tags: string[];
  help: string;
  nodes: { target: unknown[] }[];
}

const coreTags = new Set(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);

function isCoreTier(violation: Violation): boolean {
  return violation.tags.some((t) => coreTags.has(t));
}

/**
 * Blocks when tier is core and impact is moderate or worse, or when impact is
 * critical in any tier; otherwise warns.
 */
export function classify(violation: Violation): GateDecision {
  const impact = violation.impact as Impact | null | undefined;
  if (impact === "critical") return "block";
  if (isCoreTier(violation) && (impact === "moderate" || impact === "serious")) return "block";
  return "warn";
}

export function partition(violations: Violation[]): {
  blocking: Violation[];
  warnings: Violation[];
} {
  const blocking: Violation[] = [];
  const warnings: Violation[] = [];
  for (const v of violations) {
    if (classify(v) === "block") {
      blocking.push(v);
    } else {
      warnings.push(v);
    }
  }
  return { blocking, warnings };
}
