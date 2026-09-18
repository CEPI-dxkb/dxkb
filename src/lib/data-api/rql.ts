import { DataApiValidationError, getResourceDefinition } from "./resources";
import type {
  DataResource,
  ResourceField,
  RqlFieldOperator,
} from "./types";

const maxRqlLength = 8_000;
const maxDepth = 12;
/** The Data API rejects an `in(...)` clause with more than this many values. */
export const maxRqlInValues = 500;
const operators = new Set([
  "and",
  "or",
  "not",
  "eq",
  "ne",
  "lt",
  "le",
  "gt",
  "ge",
  "in",
  "keyword",
]);
const transportOperators = new Set(["select", "sort", "limit", "facet"]);
const fieldOperators = new Set(["eq", "ne", "lt", "le", "gt", "ge", "in"]);
// These resources join through their genome ID when filtering by genome metadata.
const genomeRelationshipResources = new Set<DataResource>([
  "genome_feature",
  "genome_sequence",
  "protein_feature",
  "protein_structure",
  "bioset",
  "ppi",
]);

function assertFieldOperator(
  resource: DataResource,
  fieldName: string,
  field: ResourceField,
  operator: string,
): asserts operator is RqlFieldOperator {
  if (!field.operators.includes(operator as RqlFieldOperator)) {
    throw new DataApiValidationError(
      `Operator ${operator} is not allowed for ${resource}.${fieldName}.`,
    );
  }
}

export type RqlValue = string | number | boolean;
export interface RqlComparison {
  operator: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
  field: string;
  value: RqlValue;
}
export interface RqlIn {
  operator: "in";
  field: string;
  values: RqlValue[];
}
export interface RqlKeyword {
  operator: "keyword";
  value: string;
}
export interface RqlLogical {
  operator: "and" | "or";
  operands: RqlExpression[];
}
export interface RqlNot {
  operator: "not";
  operand: RqlExpression;
}
export interface RqlGenomeRelationship {
  operator: "genome";
  target?: "genome_id_a";
  operand: RqlExpression;
}
export type RqlExpression =
  | RqlComparison
  | RqlIn
  | RqlKeyword
  | RqlLogical
  | RqlNot
  | RqlGenomeRelationship;

function splitArguments(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) escaped = false;
    else if (char === "\\" && quoted) escaped = true;
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === "(") depth += 1;
    else if (!quoted && char === ")") depth -= 1;
    else if (!quoted && char === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
    if (depth < 0)
      throw new DataApiValidationError("Malformed RQL parentheses.");
  }
  if (quoted || depth !== 0)
    throw new DataApiValidationError("Malformed RQL expression.");
  parts.push(value.slice(start).trim());
  return parts;
}

function decodeValue(value: string): string {
  const unquoted =
    value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1).replace(/\\(["\\])/g, "$1")
      : value;
  try {
    return decodeURIComponent(unquoted);
  } catch {
    throw new DataApiValidationError("RQL contains invalid percent encoding.");
  }
}

function coerceValue(
  value: string,
  field: ResourceField,
  allowWildcard = false,
): RqlValue {
  const decoded = decodeValue(value);
  if (decoded === "*" && allowWildcard) return decoded;
  if (field.type === "number") {
    const number = Number(decoded);
    if (!Number.isFinite(number))
      throw new DataApiValidationError("RQL numeric value is invalid.");
    return number;
  }
  if (field.type === "boolean") {
    if (decoded !== "true" && decoded !== "false") {
      throw new DataApiValidationError(
        "RQL boolean value must be true or false.",
      );
    }
    return decoded === "true";
  }
  return decoded;
}

function parseExpression(
  resource: DataResource,
  input: string,
  depth: number,
): RqlExpression {
  if (depth > maxDepth)
    throw new DataApiValidationError("RQL nesting is too deep.");
  const match = /^([a-z_]+)\((.*)\)$/.exec(input.trim());
  if (!match) throw new DataApiValidationError("Malformed RQL expression.");
  const operator = match[1];
  if (transportOperators.has(operator)) {
    throw new DataApiValidationError(
      `Transport operator ${operator} is not allowed in RQL.`,
    );
  }
  const args = splitArguments(match[2]);
  if (operator === "genome") {
    if (!genomeRelationshipResources.has(resource))
      throw new DataApiValidationError(`Unsupported RQL operator: ${operator}`);
    if (resource === "ppi") {
      if (args.length !== 2 || args[0] !== "to(genome_id_a)") {
        throw new DataApiValidationError(
          "ppi genome requires to(genome_id_a) and one operand.",
        );
      }
      return {
        operator,
        target: "genome_id_a",
        operand: parseExpression("genome", args[1], depth + 1),
      };
    }
    if (args.length !== 1)
      throw new DataApiValidationError("genome requires one operand.");
    return {
      operator,
      operand: parseExpression("genome", args[0], depth + 1),
    };
  }
  if (!operators.has(operator))
    throw new DataApiValidationError(`Unsupported RQL operator: ${operator}`);

  if (operator === "and" || operator === "or") {
    if (args.length < 2)
      throw new DataApiValidationError(
        `${operator} requires at least two operands.`,
      );
    return {
      operator,
      operands: args.map((arg) => parseExpression(resource, arg, depth + 1)),
    };
  }
  if (operator === "not") {
    if (args.length !== 1)
      throw new DataApiValidationError("not requires one operand.");
    return { operator, operand: parseExpression(resource, args[0], depth + 1) };
  }
  if (operator === "keyword") {
    if (args.length !== 1)
      throw new DataApiValidationError("keyword requires one value.");
    return { operator, value: decodeValue(args[0]) };
  }

  if (!fieldOperators.has(operator) || args.length !== 2) {
    throw new DataApiValidationError(`${operator} requires a field and value.`);
  }
  const fieldName = args[0];
  const fields = getResourceDefinition(resource).fields;
  if (!Object.hasOwn(fields, fieldName))
    throw new DataApiValidationError(
      `Field ${fieldName} is not allowed for ${resource}.`,
    );
  const field = fields[fieldName];
  assertFieldOperator(resource, fieldName, field, operator);
  if (operator === "in") {
    if (!args[1].startsWith("(") || !args[1].endsWith(")")) {
      throw new DataApiValidationError("in values must be parenthesized.");
    }
    const rawValues = args[1].slice(1, -1);
    // `splitArguments` always returns at least one part (even for an empty
    // string), so an empty argument list — in(field,()) — would otherwise be
    // indistinguishable from a single quoted empty string — in(field,("")) —
    // and pass the "at least one value" check below with a phantom "" value.
    // Treat a blank (unquoted) interior as zero values; a quoted empty
    // string still decodes to a real "" value, consistent with decodeValue()
    // elsewhere in this file (e.g. eq(field,"") already yields "").
    const values = rawValues.trim() === "" ? [] : splitArguments(rawValues);
    // A blank slot embedded between commas — in(field,(1,,3)) — or a stray
    // leading/trailing comma — in(field,(1,3,)) or in(field,(,1,3)) —
    // survives splitArguments as an unquoted "" element instead of reducing
    // the argument count, so it must be rejected the same way as a fully
    // blank interior. A *quoted* empty string element is the two-character
    // string `""`, not an empty string, so it is unaffected by this check.
    if (
      values.length === 0 ||
      values.length > maxRqlInValues ||
      values.some((value) => value === "")
    )
      throw new DataApiValidationError(
        `in requires 1 to ${maxRqlInValues.toLocaleString()} values.`,
      );
    return {
      operator,
      field: fieldName,
      values: values.map((value) => coerceValue(value, field)),
    };
  }
  return {
    operator,
    field: fieldName,
    value: coerceValue(
      args[1],
      field,
      operator === "eq" || operator === "ne",
    ),
  };
}

export function parseRql(resource: DataResource, rql: string): RqlExpression {
  if (!rql || rql.length > maxRqlLength)
    throw new DataApiValidationError(
      "RQL must be between 1 and 8000 characters.",
    );
  return parseExpression(resource, rql, 0);
}

function serializeValue(value: RqlValue, field?: ResourceField): string {
  if (typeof value !== "string") return String(value);
  if (value === "") {
    if (field?.quote === "never") {
      throw new DataApiValidationError(
        "Empty strings cannot be serialized for an unquoted field.",
      );
    }
    return '""';
  }
  const encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  const quote =
    field?.quote === "always" || (field?.quote !== "never" && /\s/.test(value));
  return quote ? `"${encoded}"` : encoded;
}

export function serializeRql(
  resource: DataResource,
  expression: RqlExpression,
): string {
  const fields = getResourceDefinition(resource).fields;
  if (expression.operator === "keyword")
    return `keyword(${serializeValue(expression.value)})`;
  if (expression.operator === "and" || expression.operator === "or") {
    if (expression.operands.length < 2)
      throw new DataApiValidationError(
        `${expression.operator} requires at least two operands.`,
      );
    return `${expression.operator}(${expression.operands.map((value) => serializeRql(resource, value)).join(",")})`;
  }
  if (expression.operator === "not")
    return `not(${serializeRql(resource, expression.operand)})`;
  if (expression.operator === "genome") {
    if (!genomeRelationshipResources.has(resource))
      throw new DataApiValidationError("Unsupported RQL operator: genome");
    if (resource === "ppi") {
      if (expression.target !== "genome_id_a") {
        throw new DataApiValidationError(
          "ppi genome requires target genome_id_a.",
        );
      }
      return `genome(to(${expression.target}),${serializeRql("genome", expression.operand)})`;
    }
    if (expression.target !== undefined) {
      throw new DataApiValidationError(
        `genome target is not allowed for ${resource}.`,
      );
    }
    return `genome(${serializeRql("genome", expression.operand)})`;
  }
  if (expression.operator === "in") {
    if (!Object.hasOwn(fields, expression.field))
      throw new DataApiValidationError(
        `Field ${expression.field} is not allowed for ${resource}.`,
      );
    const field = fields[expression.field];
    assertFieldOperator(resource, expression.field, field, expression.operator);
    if (
      expression.values.length === 0 ||
      expression.values.length > maxRqlInValues
    )
      throw new DataApiValidationError(
        `in requires 1 to ${maxRqlInValues.toLocaleString()} values.`,
      );
    return `in(${expression.field},(${expression.values.map((value) => serializeValue(value, field)).join(",")}))`;
  }
  const comparison = expression as RqlComparison;
  if (!Object.hasOwn(fields, comparison.field))
    throw new DataApiValidationError(
      `Field ${comparison.field} is not allowed for ${resource}.`,
    );
  const field = fields[comparison.field];
  assertFieldOperator(
    resource,
    comparison.field,
    field,
    comparison.operator,
  );
  return `${comparison.operator}(${comparison.field},${serializeValue(comparison.value, field)})`;
}

export function validateRql(resource: DataResource, rql: string): string {
  return serializeRql(resource, parseRql(resource, rql));
}

export function eq(
  resource: DataResource,
  field: string,
  value: RqlValue,
): string {
  return serializeRql(resource, { operator: "eq", field, value });
}
