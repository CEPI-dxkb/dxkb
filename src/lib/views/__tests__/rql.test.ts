import { escapeRqlValue, rqlEq, rqlKeyword } from "../rql";

describe("escapeRqlValue", () => {
  it("passes plain alphanumeric values through unchanged", () => {
    expect(escapeRqlValue("Escherichia")).toBe("Escherichia");
  });
  it("percent-encodes RQL-special characters", () => {
    expect(escapeRqlValue("a,b")).toBe("a%2Cb");
    expect(escapeRqlValue("flu)")).toBe("flu%29");
    expect(escapeRqlValue("(x")).toBe("%28x");
  });
});

describe("rqlEq / rqlKeyword", () => {
  it("builds an eq clause with an escaped value", () => {
    expect(rqlEq("genus", "Escherichia")).toBe("eq(genus,Escherichia)");
    expect(rqlEq("name", "a,b")).toBe("eq(name,a%2Cb)");
  });
  it("builds a keyword clause with an escaped value", () => {
    expect(rqlKeyword("flu)")).toBe("keyword(flu%29)");
  });
});
