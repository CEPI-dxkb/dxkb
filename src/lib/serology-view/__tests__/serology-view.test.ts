// See src/lib/phylogeny/__tests__/dataset-store.test.ts: `server-only` throws
// unconditionally outside Next's bundler, so any test importing a module
// gated by it (this file imports `./server`, which now pulls in
// `@/lib/data-api/server-repository`) neutralizes the guard.
vi.mock("server-only", () => ({}));

import {
  formatSerologyDate,
  isSerologySampleId,
  parseSerologyCollectionState,
  serologyCollectionProfile,
  serologyStructuralRql,
  serologyViewRecordSchema,
} from "@/lib/serology-view";
import { resolveSerology } from "@/lib/serology-view/server";

describe("Serology view contracts", () => {
  it("preserves backend order by default to match the legacy collection", () => {
    expect(parseSerologyCollectionState({}).sort).toBe("unsorted");
    expect(parseSerologyCollectionState({ sort: "sample_identifier:asc" }).sort).toBe(
      "sample_identifier:asc",
    );
  });

  it("keeps sample identifiers and test types scalar strings", () => {
    expect(isSerologySampleId("000123")).toBe(true);
    expect(isSerologySampleId("")).toBe(false);
    expect(
      serologyViewRecordSchema.parse({
        id: "backend-1",
        sample_identifier: "000123",
        test_type: "ELISA/IgG test",
        serotype: ["H7N9"],
        custom_member_field: "retained",
      }),
    ).toMatchObject({
      sample_identifier: "000123",
      custom_member_field: "retained",
    });
    expect(() =>
      serologyViewRecordSchema.parse({
        id: "backend-1",
        sample_identifier: "000123",
        test_type: ["ELISA"],
      }),
    ).toThrow();
  });

  it("preserves source date precision", () => {
    expect(formatSerologyDate("2024")).toBe("2024");
    expect(formatSerologyDate("2024-06")).toBe("2024-06");
    expect(formatSerologyDate("2024-06-15T14:30:00Z")).toBe("2024-06-15");
    expect(formatSerologyDate("spring 2024")).toBe("spring 2024");
  });

  it("supports repeated facets and field-specific unquoted test types", () => {
    const state = parseSerologyCollectionState({
      test_type: [
        "neutralizing antibody",
        "ELISA/IgG",
        "neutralizing antibody",
      ],
      collection_country: "US",
      page: "2",
    });
    expect(state.filters.test_type).toEqual([
      "neutralizing antibody",
      "ELISA/IgG",
    ]);
    expect(state.page).toBe(2);
    expect(serologyStructuralRql(state)).toBe(
      "and(eq(collection_country,US),or(eq(test_type,neutralizing%20antibody),eq(test_type,ELISA%2FIgG)))",
    );

    const explicit = parseSerologyCollectionState({
      test_type: "ELISA",
      rql: "eq(collection_country,US)",
    });
    expect(explicit.filters).toEqual({});
    expect(serologyStructuralRql(explicit)).toBeUndefined();
  });

  it("uses backend id for row identity and public compound member links", () => {
    expect(serologyCollectionProfile.idField).toBe("id");
    expect(serologyCollectionProfile.rowLinkField).toBe("sample_identifier");
    expect(
      serologyCollectionProfile.rowHref?.({
        id: "1",
        sample_identifier: "000123",
        test_type: "ELISA/IgG test",
      }),
    ).toBe("/serology/000123?test_type=ELISA%2FIgG%20test");
  });
});

describe("resolveSerology", () => {
  it("uses scalar compound predicates without coercing digit-only IDs", async () => {
    const collection = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "1",
          sample_identifier: "000123",
          test_type: "ELISA/IgG test",
        },
      ],
      total: 1,
      facets: {},
      page: 1,
      pageSize: 2,
    });
    await expect(
      resolveSerology({ collection }, "000123", "ELISA/IgG test"),
    ).resolves.toMatchObject({
      status: "unique",
      record: { sample_identifier: "000123" },
    });
    expect(collection).toHaveBeenCalledWith(
      "serology",
      expect.objectContaining({
        rql: "and(eq(sample_identifier,000123),eq(test_type,ELISA%2FIgG%20test))",
        pageSize: 2,
      }),
    );
  });

  it("returns sorted unique discriminator choices for ambiguous samples", async () => {
    const collection = vi.fn().mockResolvedValue({
      rows: [
        { id: "1", sample_identifier: "123", test_type: "Western blot" },
        { id: "2", sample_identifier: "123", test_type: "ELISA/IgG" },
      ],
      total: 3,
      facets: {
        test_type: [
          { value: "Western blot", count: 1 },
          { value: "", count: 1 },
          { value: "shared", count: 2 },
          { value: "ELISA/IgG", count: 1 },
        ],
      },
      page: 1,
      pageSize: 2,
    });
    await expect(resolveSerology({ collection }, "123")).resolves.toEqual({
      status: "ambiguous",
      testTypes: ["ELISA/IgG", "Western blot"],
    });
  });

  it("distinguishes missing records and preserves repository errors", async () => {
    const empty = vi.fn().mockResolvedValue({
      rows: [],
      total: 0,
      facets: {},
      page: 1,
      pageSize: 2,
    });
    await expect(
      resolveSerology({ collection: empty }, "missing"),
    ).resolves.toEqual({
      status: "not-found",
    });
    const failure = vi
      .fn()
      .mockRejectedValue(new Error("Serology upstream unavailable"));
    await expect(
      resolveSerology({ collection: failure }, "123"),
    ).rejects.toThrow("Serology upstream unavailable");
  });
});
