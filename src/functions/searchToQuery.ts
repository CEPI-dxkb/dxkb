export function searchToQuery(expression: string, field?: string): string {
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
          const sub = searchToQuery(subExp, expField);
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

          // Process completed token
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
            const keywordExp = `keyword(${encodeURIComponent(exp)})`;

            if (preOp === "not") {
              exprs.push(`not(${keywordExp})`);
              preOp = false;
            } else if (ors) {
              ors.push(field ? exp : keywordExp);
            } else {
              exprs.push(keywordExp);
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
        exprs.push(`not(keyword(${encodeURIComponent(exp)}))`);
      }
      preOp = false;
    } else {
      let finalExp: string;

      if (expField) {
        finalExp = `eq(${encodeURIComponent(expField)},${encodeURIComponent(exp)})`;
        expField = "";
      } else {
        finalExp = `keyword(${encodeURIComponent(exp)})`;
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
          ors.push(finalExp);
          exprs.push(`or(${ors.join(",")})`);
        }
        ors = false;
      } else {
        exprs.push(finalExp);
      }
    }
  }

  if (exprs.length === 1) {
    return exprs[0];
  }

  return `and(${exprs.join(",")})`;
}
