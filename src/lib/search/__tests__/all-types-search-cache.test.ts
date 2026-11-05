import { allTermSearchTypes } from "@/constants/search-info";
import {
  allTypesSearchQueryOptions,
  isCompleteTypeMatches,
  type TypeMatches,
} from "../all-types-search";

function answer(numFound: number) {
  return { result: { response: { docs: [], numFound } } };
}

function completeMatches(): TypeMatches {
  return Object.fromEntries(allTermSearchTypes.map((type) => [type.id, answer(0)]));
}

function staleTimeFor(data: TypeMatches | undefined): unknown {
  const { staleTime } = allTypesSearchQueryOptions("e coli", "anonymous");
  if (typeof staleTime !== "function") return staleTime;
  return staleTime({ state: { data } } as unknown as Parameters<typeof staleTime>[0]);
}

describe("allTypesSearchQueryOptions", () => {
  it("keeps a complete slow search fresh for 10 minutes and cached for 30", () => {
    expect(staleTimeFor(completeMatches())).toBe(10 * 60_000);
    expect(allTypesSearchQueryOptions("e coli", "anonymous").gcTime).toBe(30 * 60_000);
  });

  it("treats an answer missing a type as stale at once", () => {
    const missingId = allTermSearchTypes[0].id;
    const partial = Object.fromEntries(
      Object.entries(completeMatches()).filter(([id]) => id !== missingId),
    );
    expect(staleTimeFor(partial)).toBe(0);
    expect(staleTimeFor(undefined)).toBe(0);
  });

  it("keeps each account's results under its own key", () => {
    const anonymous = allTypesSearchQueryOptions("e coli", "anonymous").queryKey;
    const signedIn = allTypesSearchQueryOptions("e coli", "alice").queryKey;
    expect(anonymous).not.toEqual(signedIn);
    expect(signedIn).toContain("alice");
  });
});

describe("isCompleteTypeMatches", () => {
  it("needs a response for every DXKB type", () => {
    expect(isCompleteTypeMatches(completeMatches())).toBe(true);
    const failed: TypeMatches = { ...completeMatches(), [allTermSearchTypes[1].id]: {} };
    expect(isCompleteTypeMatches(failed)).toBe(false);
  });
});
