function addQuotes(str: string): string {
  // Adds quotes only if missing
  if (str.startsWith('"') && str.endsWith('"')) {
    return str;
  }
  return `"${str}"`;
}

export function searchToQueryWithQuoteAnd(
  expression: string,
  field?: string
): string {
  let exprs: string[] = [];
  let exp = "";
  let expField = "";
  let openParans = 0;
  let subExp = "";
  let preOp: "not" | false = false;
  let prev: string | false = false;
  let ors: string[] | false = false;
  let quoted = false;

  for (let i = 0; i < expression.length; i++) {
    const curChar = expression[i];

    switch (curChar) {
      case '"':
        if (!quoted) {
          quoted = true;
          exp = '"';
        } else {
          exp += '"';
          quoted = false;
        }
        break;

      case "(":
        openParans++;
        break;

      case ")":
        openParans--;

        if (openParans < 1) {
          const sub = searchToQueryWithQuoteAnd(subExp, expField);
          exprs.push(sub);
          subExp = "";
          expField = "";
        } else {
          throw Error("Unexpected ')' at character " + i);
        }
        break;

      case " ":
        if (openParans > 0) {
          subExp += curChar;
        } else if (quoted) {
          exp += curChar;
        } else if (exp) {
          const lower = exp.toLowerCase();

          if (lower === "not") {
            preOp = "not";
            exp = "";
            break;
          } else if (lower === "or") {
            if (!ors) {
              const pe = exprs.pop();
              ors = [field ? (prev as string) : (pe as string)];
            }
            exp = "";
            break;
          } else if (lower === "and") {
            exp = "";
            break;
          }

          // Process token
          if (expField) {
            if (preOp === "not") {
              exprs.push(
                `ne(${encodeURIComponent(expField)},${encodeURIComponent(exp)})`
              );
              preOp = false;
            } else {
              if (ors && ors.length > 1) {
                exprs.push(
                  `in(${encodeURIComponent(expField)},(${ors
                    .map(encodeURIComponent)
                    .join(",")}))`
                );
                ors = false;
              } else {
                exprs.push(
                  `eq(${encodeURIComponent(expField)},${encodeURIComponent(exp)})`
                );
              }
            }
            expField = "";
          } else {
            const e = `keyword(${encodeURIComponent(addQuotes(exp))})`;

            if (preOp === "not") {
              exprs.push(`not(${e})`);
              preOp = false;
            } else if (ors) {
              if (field) {
                ors.push(exp);
              } else {
                ors.push(e);
              }
            } else {
              exprs.push(e);
            }
          }

          prev = exp;
          exp = "";
        }
        break;

      case ":":
        if (openParans > 0) {
          subExp += curChar;
          break;
        }

        if (exp) {
          expField = exp;
          exp = "";
        } else {
          throw Error("Unexpected ':' at character " + i);
        }
        break;

      default:
        if (openParans > 0) {
          subExp += curChar;
        } else {
          exp += curChar;
        }
        break;
    }
  }

  // Final flush
  if (exp) {
    if (preOp === "not") {
      if (expField) {
        exprs.push(
          `ne(${encodeURIComponent(expField)},${encodeURIComponent(exp)})`
        );
      } else {
        exprs.push(
          `not(keyword(${encodeURIComponent(addQuotes(exp))}))`
        );
      }
      preOp = false;
    } else {
      let e: string;

      if (expField) {
        e = `eq(${encodeURIComponent(expField)},${encodeURIComponent(exp)})`;
        expField = "";
      } else {
        e = `keyword(${encodeURIComponent(addQuotes(exp))})`;
      }

      if (ors) {
        if (field) {
          ors.push(exp);
          exprs.push(
            `in(${encodeURIComponent(field)},(${ors
              .map(encodeURIComponent)
              .join(",")}))`
          );
        } else {
          ors.push(e);
          exprs.push(`or(${ors.join(",")})`);
        }
        ors = false;
      } else {
        exprs.push(e);
      }
    }
  }

  if (exprs.length === 1) {
    return exprs[0];
  }

  return `and(${exprs.join(",")})`;
}
