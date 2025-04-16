/**
 * Search query utility functions for handling different types of search operations
 */

/**
 * Adds quotes to a string if it doesn't already have them
 * @param str The string to add quotes to
 * @returns The quoted string
 */
function addQuotes(str: string): string {
  if (str.charAt(0) === '"' && str.charAt(str.length - 1) === '"') {
    return str;
  }
  return `"${str}"`;
}

/**
 * Base interface for search expression parsing state
 */
interface ParseState {
  exprs: string[];
  exp: string;
  expField: string;
  openParans: number;
  subExp: string;
  preOp: string | false;
  prev: string | false;
  ors: string[] | false;
  quoted: boolean;
}

/**
 * Parses a search expression into a query string
 * @param expression The search expression to parse
 * @param field Optional field to search in
 * @param options Configuration options for parsing
 * @returns The parsed query string
 */
function parseExpression(
  expression: string,
  field: string | undefined,
  options: {
    useOr: boolean;
    addQuotes: boolean;
  },
): string {
  const state: ParseState = {
    exprs: [],
    exp: "",
    expField: "",
    openParans: 0,
    subExp: "",
    preOp: false,
    prev: false,
    ors: false,
    quoted: false,
  };

  for (let i = 0; i < expression.length; i++) {
    const curChar = expression[i];

    switch (curChar) {
      case '"':
        if (!state.quoted) {
          state.quoted = true;
          state.exp = '"';
        } else {
          state.exp += '"';
          state.quoted = false;
        }
        break;

      case "(":
        state.openParans++;
        break;

      case ")":
        state.openParans--;
        if (state.openParans < 1) {
          const sub = parseExpression(state.subExp, state.expField, options);
          state.exprs.push(sub);
          state.subExp = "";
          state.expField = "";
        } else {
          throw new Error(`Unexpected ')' at character ${i}`);
        }
        break;

      case " ":
        if (state.openParans > 0) {
          state.subExp += curChar;
        } else if (state.quoted) {
          state.exp += curChar;
        } else if (state.exp) {
          if (state.exp.toLowerCase() === "not") {
            state.preOp = "not";
            state.exp = "";
            break;
          } else if (state.exp.toLowerCase() === "or") {
            if (!state.ors) {
              const pe = state.exprs.pop();
              state.ors = [field ? (state.prev as string) : (pe as string)];
            }
            state.exp = "";
            break;
          } else if (state.exp.toLowerCase() === "and") {
            state.exp = "";
            break;
          }

          if (state.expField) {
            if (state.preOp === "not") {
              state.exprs.push(
                `ne(${encodeURIComponent(state.expField)},${encodeURIComponent(state.exp)})`,
              );
              state.preOp = false;
            } else {
              if (state.ors && state.ors.length > 1) {
                state.exprs.push(
                  `in(${encodeURIComponent(state.expField)},(${state.ors.map(encodeURIComponent).join(",")}))`,
                );
                state.ors = false;
              } else {
                state.exprs.push(
                  `eq(${encodeURIComponent(state.expField)},${encodeURIComponent(state.exp)})`,
                );
              }
            }
            state.expField = "";
          } else {
            const exp = options.addQuotes ? addQuotes(state.exp) : state.exp;
            const e = `keyword(${encodeURIComponent(exp)})`;

            if (state.preOp === "not") {
              state.exprs.push(`not(${e})`);
              state.preOp = false;
            } else if (state.ors) {
              if (field) {
                state.ors.push(state.exp);
              } else {
                state.ors.push(e);
              }
            } else {
              state.exprs.push(e);
            }
          }
          state.prev = state.exp;
          state.exp = "";
        }
        break;

      case ":":
        if (state.openParans > 0) {
          state.subExp += curChar;
          break;
        }

        if (state.exp) {
          state.expField = state.exp;
          state.exp = "";
        } else {
          throw new Error(`Unexpected ':' at character ${i}`);
        }
        break;

      default:
        if (state.openParans > 0) {
          state.subExp += curChar;
        } else {
          state.exp += curChar;
        }
        break;
    }
  }

  if (state.exp) {
    if (state.preOp === "not") {
      if (state.expField) {
        state.exprs.push(
          `ne(${encodeURIComponent(state.expField)},${encodeURIComponent(state.exp)})`,
        );
      } else {
        const exp = options.addQuotes ? addQuotes(state.exp) : state.exp;
        state.exprs.push(`not(keyword(${encodeURIComponent(exp)}))`);
      }
      state.preOp = false;
    } else {
      let e: string;
      if (state.expField) {
        e = `eq(${encodeURIComponent(state.expField)},${encodeURIComponent(state.exp)})`;
        state.expField = "";
      } else {
        const exp = options.addQuotes ? addQuotes(state.exp) : state.exp;
        e = `keyword(${encodeURIComponent(exp)})`;
      }

      if (state.ors) {
        if (field) {
          state.ors.push(state.exp);
          state.exprs.push(
            `in(${encodeURIComponent(field)},(${state.ors.map(encodeURIComponent).join(",")}))`,
          );
        } else {
          state.ors.push(e);
          state.exprs.push(`or(${state.ors.join(",")})`);
        }
        state.ors = false;
      } else {
        state.exprs.push(e);
      }
    }
  }

  if (state.exprs.length === 1) {
    return state.exprs[0];
  }

  return options.useOr
    ? `or(${state.exprs.join(",")})`
    : `and(${state.exprs.join(",")})`;
}

/**
 * Default search query parser that uses AND operator
 * @param expression The search expression to parse
 * @param field Optional field to search in
 * @returns The parsed query string
 */
export function searchToQuery(expression: string, field?: string): string {
  return parseExpression(expression, field, { useOr: false, addQuotes: false });
}

/**
 * Search query parser that uses OR operator
 * @param expression The search expression to parse
 * @param field Optional field to search in
 * @returns The parsed query string
 */
export function searchToQueryWithOr(
  expression: string,
  field?: string,
): string {
  return parseExpression(expression, field, { useOr: true, addQuotes: false });
}

/**
 * Search query parser that uses OR operator and adds quotes to terms
 * @param expression The search expression to parse
 * @param field Optional field to search in
 * @returns The parsed query string
 */
export function searchToQueryWithQuoteOr(
  expression: string,
  field?: string,
): string {
  return parseExpression(expression, field, { useOr: true, addQuotes: true });
}

/**
 * Search query parser that uses AND operator and adds quotes to terms
 * @param expression The search expression to parse
 * @param field Optional field to search in
 * @returns The parsed query string
 */
export function searchToQueryWithQuoteAnd(
  expression: string,
  field?: string,
): string {
  return parseExpression(expression, field, { useOr: false, addQuotes: true });
}
