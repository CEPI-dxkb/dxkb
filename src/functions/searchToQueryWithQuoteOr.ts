function addQuotes(str) {
  return str.startsWith('"') && str.endsWith('"') ? str : `"${str}"`;
}

export function searchToQueryWithQuoteOr(expression, field) {
  const exprs = [];
  let exp = '';
  let expField = '';
  let openParans = 0;
  let subExp = '';
  let preOp = false;
  let prev = false;
  let ors = false;
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

      case '(':
        openParans++;
        break;

      case ')':
        openParans--;
        if (openParans < 1) {
          const sub = searchToQueryWithQuoteOr(subExp, expField);
          exprs.push(sub);
          subExp = '';
          expField = '';
        } else {
          throw Error(`Unexpected ')' at character ${i}`);
        }
        break;

      case ' ':
        if (openParans > 0) {
          subExp += curChar;
        } else if (quoted) {
          exp += curChar;
        } else if (exp) {
          const lower = exp.toLowerCase();

          if (lower === 'not') {
            preOp = 'not';
            exp = '';
            break;
          }

          if (lower === 'or') {
            if (!ors) {
              const pe = exprs.pop();
              ors = [field ? prev : pe];
            }
            exp = '';
            break;
          }

          if (lower === 'and') {
            exp = '';
            break;
          }

          if (expField) {
            if (preOp === 'not') {
              exprs.push(`ne(${encodeURIComponent(expField)},${encodeURIComponent(exp)})`);
              preOp = false;
            } else {
              if (ors && ors.length > 1) {
                exprs.push(
                  `in(${encodeURIComponent(expField)},(${ors.map(encodeURIComponent).join(',')}))`
                );
                ors = false;
              } else {
                exprs.push(`eq(${encodeURIComponent(expField)},${encodeURIComponent(exp)})`);
              }
            }
            expField = '';
          } else {
            const keywordExpr = `keyword(${encodeURIComponent(addQuotes(exp))})`;

            if (preOp === 'not') {
              exprs.push(`not(${keywordExpr})`);
              preOp = false;
            } else if (ors) {
              if (field) {
                ors.push(exp);
              } else {
                ors.push(keywordExpr);
              }
            } else {
              exprs.push(keywordExpr);
            }
          }

          prev = exp;
          exp = '';
        }
        break;

      case ':':
        if (openParans > 0) {
          subExp += curChar;
        } else if (exp) {
          expField = exp;
          exp = '';
        } else {
          throw Error(`Unexpected ':' at character ${i}`);
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

  // finalize last exp
  if (exp) {
    if (preOp === 'not') {
      if (expField) {
        exprs.push(`ne(${encodeURIComponent(expField)},${encodeURIComponent(exp)})`);
      } else {
        exprs.push(`not(keyword(${encodeURIComponent(addQuotes(exp))}))`);
      }
      preOp = false;
    } else {
      let e;

      if (expField) {
        e = `eq(${encodeURIComponent(expField)},${encodeURIComponent(exp)})`;
        expField = '';
      } else {
        e = `keyword(${encodeURIComponent(addQuotes(exp))})`;
      }

      if (ors) {
        if (field) {
          ors.push(exp);
          exprs.push(
            `in(${encodeURIComponent(field)},(${ors.map(encodeURIComponent).join(',')}))`
          );
        } else {
          ors.push(e);
          exprs.push(`or(${ors.join(',')})`);
        }
        ors = false;
      } else {
        exprs.push(e);
      }
    }
  }

  return exprs.length === 1 ? exprs[0] : `or(${exprs.join(',')})`;
}
