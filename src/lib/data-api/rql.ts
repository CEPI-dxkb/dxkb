import { keywordQuery, keywordQueryClauses } from "./keyword-terms";
import { DataApiValidationError, getResourceDefinition } from "./resources";
import type {
  DataResource,
  ResourceField,
  RqlFieldOperator,
} from "./types";

const maxRqlLength = 8_000;
const maxDepth = 12;
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
// A resource whose genome ID field is not `genome_id` names it with `to(...)`.
const genomeRelationshipTargets = new Map<
  DataResource,
  RqlGenomeRelationship["target"]
>([
  ["genome_amr", undefined],
  ["genome_feature", undefined],
  ["genome_sequence", undefined],
  ["protein_feature", undefined],
  ["protein_structure", undefined],
  ["bioset", undefined],
  ["ppi", "genome_id_a"],
  ["strain", "genome_ids"],
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
  /**
   * Quotes included: unquoted words are ANDed in any order; only a quoted span
   * is a phrase or exact token.
   */
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
  target?: "genome_id_a" | "genome_ids";
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

function percentDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new DataApiValidationError("RQL contains invalid percent encoding.");
  }
}

function decodeValue(value: string): string {
  return percentDecode(
    value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1).replace(/\\(["\\])/g, "$1")
      : value,
  );
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
    if (!genomeRelationshipTargets.has(resource))
      throw new DataApiValidationError(`Unsupported RQL operator: ${operator}`);
    const target = genomeRelationshipTargets.get(resource);
    if (target) {
      if (args.length !== 2 || args[0] !== `to(${target})`) {
        throw new DataApiValidationError(
          `${resource} genome requires to(${target}) and one operand.`,
        );
      }
      return {
        operator,
        target,
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
    // A keyword's quotes are part of what it matches: keyword("Rv0001") is an
    // exact token, keyword(Rv0001) is not.
    return { operator, value: percentDecode(args[0]) };
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
    // `splitArguments` returns one part even for an empty string, so a blank
    // unquoted interior counts as zero values; a quoted `""` still decodes to a
    // real empty value.
    const values = rawValues.trim() === "" ? [] : splitArguments(rawValues);
    // A blank slot between commas, or a stray leading/trailing comma, survives
    // `splitArguments` as an unquoted "" and must be rejected; a quoted `""` is
    // unaffected.
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

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** `! ' ( ) ~`: what `encodeURIComponent` leaves raw that RQL rejects. */
const dataApiUnsafeValueChars = /%(?:21|27|28|29|7E)/gi;

/**
 * Rewrites canonical RQL for the Data API only. The Data API decodes each
 * value, re-encodes it with `encodeURIComponent` (which leaves `! ' ( ) ~`
 * raw) and parses the result again, so a value holding one of those
 * characters is HTTP 400 however it is encoded (`5'UTR` feature IDs, the
 * `262(1)S` serology sample). Outside quotes, Solr's single-character wildcard
 * `?` matches the character instead. Inside quotes the wildcard is unreliable
 * (a phrase on a tokenized field can match another row), so a quoted value
 * keeps its encoding and its visible error. Browser URLs and URL state keep the
 * real value; only the request leaving the server is rewritten.
 */
export function upstreamRql(rql: string): string {
  return rql
    .split('"')
    .map((part, index) =>
      index % 2 === 0 ? part.replace(dataApiUnsafeValueChars, "%3F") : part,
    )
    .join('"');
}

function serializeValue(value: RqlValue, field?: ResourceField): string {
  if (typeof value !== "string") return String(value);
  // "" has no unquoted form (`eq(test_type,)` is HTTP 400), so even a field
  // that is never quoted writes it as `""`: a facet's "(empty)" bucket.
  if (value === "") return '""';
  const encoded = percentEncode(value);
  // The Data API decodes the value into a Solr query, where a bare `:` reads as
  // a field separator (`culture_collection:FDA:FDAARGOS_855`, HTTP 400), so a
  // string with one is quoted, even on a never-quoted field: its bare form
  // cannot match anything. Dates and numbers keep their bare form.
  const quote =
    field?.quote === "always" ||
    (field?.type === "string" && value.includes(":")) ||
    (field?.quote !== "never" && /\s/.test(value));
  return quote ? `"${encoded}"` : encoded;
}

/**
 * Never wrapped in quotes: quoting `coli Salmonella` would turn the any-order
 * match into a phrase. Its own quotes travel as `%22`.
 */
function serializeKeyword(value: string): string {
  return `keyword(${value === "" ? '""' : percentEncode(value)})`;
}

/**
 * The download path passes its own `maxValues`, because a selection download
 * must not be split into batches the file would have to be stitched from.
 */
export function serializeInClause(
  resource: DataResource,
  fieldName: string,
  values: readonly RqlValue[],
  maxValues = maxRqlInValues,
): string {
  const fields = getResourceDefinition(resource).fields;
  if (!Object.hasOwn(fields, fieldName))
    throw new DataApiValidationError(
      `Field ${fieldName} is not allowed for ${resource}.`,
    );
  const field = fields[fieldName];
  assertFieldOperator(resource, fieldName, field, "in");
  if (values.length === 0 || values.length > maxValues)
    throw new DataApiValidationError(
      `in requires 1 to ${maxValues.toLocaleString()} values.`,
    );
  return `in(${fieldName},(${values.map((value) => serializeValue(value, field)).join(",")}))`;
}

export function serializeRql(
  resource: DataResource,
  expression: RqlExpression,
): string {
  const fields = getResourceDefinition(resource).fields;
  if (expression.operator === "keyword")
    return serializeKeyword(expression.value);
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
    if (!genomeRelationshipTargets.has(resource))
      throw new DataApiValidationError("Unsupported RQL operator: genome");
    const target = genomeRelationshipTargets.get(resource);
    if (target) {
      if (expression.target !== target) {
        throw new DataApiValidationError(
          `${resource} genome requires target ${target}.`,
        );
      }
      return `genome(to(${target}),${serializeRql("genome", expression.operand)})`;
    }
    if (expression.target !== undefined) {
      throw new DataApiValidationError(
        `genome target is not allowed for ${resource}.`,
      );
    }
    return `genome(${serializeRql("genome", expression.operand)})`;
  }
  if (expression.operator === "in")
    return serializeInClause(resource, expression.field, expression.values);
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

/**
 * An unquoted word is exact or a token prefix (`word*`); a quoted term is
 * always exact, quotes included, as `%22`.
 * Views that scope another collection by keyword build the clause here too, so
 * both cover the same records.
 */
export function keywordClauses(
  keyword: string,
  mode: "exact" | "prefix" = "prefix",
): string[] {
  return keywordQueryClauses(keywordQuery(keyword), (term) =>
    percentEncode(mode === "exact" || term.startsWith('"') ? term : `${term}*`),
  );
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
