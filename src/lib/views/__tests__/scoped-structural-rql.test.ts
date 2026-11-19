import type { CollectionState } from "@/lib/views/collection-state";
import { scopedStructuralRql } from "@/lib/views/scoped-structural-rql";

const state: CollectionState = { filters: {}, page: 1, sort: "id:asc" };

describe("scopedStructuralRql", () => {
  it("returns the scope when there is no builder", () => {
    expect(scopedStructuralRql("eq(a,1)")(state)).toBe("eq(a,1)");
  });

  it("returns the scope when the builder yields no clause", () => {
    expect(scopedStructuralRql("eq(a,1)", () => undefined)(state)).toBe(
      "eq(a,1)",
    );
  });

  it("ands the scope with the builder's clause", () => {
    expect(scopedStructuralRql("eq(a,1)", () => "eq(b,2)")(state)).toBe(
      "and(eq(a,1),eq(b,2))",
    );
  });
});
