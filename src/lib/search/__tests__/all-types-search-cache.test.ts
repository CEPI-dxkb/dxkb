import { allTypesSearchQueryOptions } from "../all-types-search";

describe("allTypesSearchQueryOptions", () => {
  it("keeps a slow public search fresh for 10 minutes and cached for 30", () => {
    const options = allTypesSearchQueryOptions("e coli");
    expect(options.staleTime).toBe(10 * 60_000);
    expect(options.gcTime).toBe(30 * 60_000);
  });
});
