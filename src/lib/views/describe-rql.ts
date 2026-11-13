import {
  parseRql,
  resourceFieldLabel,
  type DataResource,
} from "@/lib/data-api";
import type { RqlExpression, RqlValue } from "@/lib/data-api/rql";

/**
 * The display label of `field` on `resource`. A `genome(...)` operand's fields
 * belong to the genome resource, so the caller is told which resource it is.
 */
export type RqlFieldLabeler = (field: string, resource: DataResource) => string;

const comparisonWords = {
  eq: "is",
  ne: "is not",
  lt: "<",
  le: "≤",
  gt: ">",
  ge: "≥",
} as const;

const maxListedValues = 4;

function valueText(value: RqlValue): string {
  return value === "" ? "(empty)" : String(value);
}

function describeNode(
  node: RqlExpression,
  resource: DataResource,
  labelFor: RqlFieldLabeler,
  nested: boolean,
): string {
  switch (node.operator) {
    case "and":
    case "or": {
      const text = node.operands
        .map((operand) => describeNode(operand, resource, labelFor, true))
        .join(` ${node.operator} `);
      return nested ? `(${text})` : text;
    }
    case "not":
      return `not (${describeNode(node.operand, resource, labelFor, false)})`;
    case "genome":
      // `parseRql` reads the operand as a genome query; a compound operand is
      // parenthesised so "Genome where (A and B)" cannot read as "(… A) and B".
      return `Genome where ${describeNode(node.operand, "genome", labelFor, true)}`;
    case "keyword":
      return `Keyword ${node.value}`;
    case "in": {
      const shown = node.values.slice(0, maxListedValues).map(valueText);
      const more = node.values.length - shown.length;
      return `${labelFor(node.field, resource)} is one of ${shown.join(", ")}${
        more > 0 ? ` and ${String(more)} more` : ""
      }`;
    }
    default: {
      const label = labelFor(node.field, resource);
      if (node.value === "*" && node.operator === "eq")
        return `${label} has a value`;
      if (node.value === "*" && node.operator === "ne")
        return `${label} has no value`;
      return `${label} ${comparisonWords[node.operator]} ${valueText(node.value)}`;
    }
  }
}

/**
 * A readable line per top-level condition of an RQL string, or null when it
 * does not parse for `resource` (the caller then shows the raw string).
 */
export function describeRql(
  resource: DataResource,
  rql: string,
  labelFor: RqlFieldLabeler,
): string[] | null {
  try {
    const parsed = parseRql(resource, rql);
    // Each operand is a line of its own but still sits under the `and`, so a
    // nested and/or operand keeps its parentheses.
    if (parsed.operator === "and")
      return parsed.operands.map((operand) =>
        describeNode(operand, resource, labelFor, true),
      );
    return [describeNode(parsed, resource, labelFor, false)];
  } catch {
    return null;
  }
}

/** The labels a collection profile shows for its own resource. */
export interface CollectionFieldLabels {
  resource: DataResource;
  columns: readonly { id: string; label: string }[];
  facets?: readonly { field: string; label: string }[];
}

/**
 * Labels fields the way the collection shows them: its own columns, then its
 * facets, for its own resource; then the field metadata of whichever resource
 * the field belongs to (so a hidden column or a `genome(...)` operand still
 * reads "Sequence ID", not `sequence_id`); else the raw field id.
 */
export function collectionFieldLabeler(
  profile: CollectionFieldLabels,
): RqlFieldLabeler {
  return (field, resource) => {
    if (resource === profile.resource) {
      const own =
        profile.columns.find((column) => column.id === field)?.label ??
        profile.facets?.find((facet) => facet.field === field)?.label;
      if (own !== undefined) return own;
    }
    return resourceFieldLabel(resource, field) ?? field;
  };
}
