import type { NextRequest } from "next/server";

/**
 * The only percent-decode is per clause in `splitClauses`, never per value: a
 * second decode would make `sample%2F1` match `sample/1` and mask the
 * double-encoding bug in `readRouteParam`. A `+` in a value reads as a space
 * (Next writes spaces as `+`), while clause text keeps its `+`.
 */

export interface FixtureQueryEquality {
  field: string;
  value: string;
}

export interface FixtureQuery {
  search: string;
  clauses: string[];
  equals: FixtureQueryEquality[];
  keywords: string[];
}

function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeQueryValue(raw: string): string {
  const unquoted =
    raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')
      ? raw.slice(1, -1)
      : raw;
  return unquoted.replace(/\+/g, " ");
}

const equalsPattern = /\beq\(([A-Za-z_][A-Za-z0-9_]*),("[^"]*"|[^(),]*)\)/g;
const keywordPattern = /\bkeyword\(("[^"]*"|[^(),]*)\)/g;

function splitClauses(search: string): string[] {
  return search
    .replace(/^\?/, "")
    .split("&")
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf("=");
      return decodeOnce(separator === -1 ? part : part.slice(0, separator));
    });
}

export function parseFixtureQuery(request: NextRequest): FixtureQuery {
  const search = new URL(request.url).search;
  const clauses = splitClauses(search);
  const joined = clauses.join("&");
  return {
    search,
    clauses,
    equals: [...joined.matchAll(equalsPattern)].map((match) => ({
      field: match[1],
      value: normalizeQueryValue(match[2]),
    })),
    keywords: [...joined.matchAll(keywordPattern)].map((match) =>
      normalizeQueryValue(match[1]),
    ),
  };
}

export function equalsValue(
  query: FixtureQuery,
  field: string,
): string | undefined {
  return query.equals.find((equality) => equality.field === field)?.value;
}

export function hasKeyword(query: FixtureQuery, value: string): boolean {
  return query.keywords.includes(value);
}

export function hasClause(query: FixtureQuery, clause: string): boolean {
  return query.clauses.includes(clause);
}

export function hasCall(query: FixtureQuery, name: string): boolean {
  return query.clauses.some((clause) => clause.includes(`${name}(`));
}

function splitArguments(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function clauseMatchesReferenceGenome(
  clause: string,
  docType: string,
): boolean {
  const call = /^([A-Za-z_]+)\(([\s\S]*)\)$/.exec(clause.trim());
  if (!call) return true;
  const [, name, args] = call;
  if (name === "and") {
    return splitArguments(args).every((part) =>
      clauseMatchesReferenceGenome(part, docType),
    );
  }
  if (name === "or") {
    return splitArguments(args).some((part) =>
      clauseMatchesReferenceGenome(part, docType),
    );
  }
  if (name === "eq") {
    const [field, value = ""] = splitArguments(args);
    if (field !== "reference_genome") return true;
    const wanted = normalizeQueryValue(value);
    return wanted === "*" ? docType !== "" : wanted === docType;
  }
  return true;
}

/** Whether a genome of `docType` satisfies every `reference_genome` equality, honouring RQL `and`/`or` grouping. */
export function matchesReferenceGenome(
  query: FixtureQuery,
  docType: string,
): boolean {
  return query.clauses.every((clause) =>
    clauseMatchesReferenceGenome(clause, docType),
  );
}
