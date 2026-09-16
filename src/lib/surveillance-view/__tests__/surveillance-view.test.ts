// See src/lib/phylogeny/__tests__/dataset-store.test.ts: `server-only` throws
// unconditionally outside Next's bundler, so any test importing a module
// gated by it (this file imports `./server`, which now pulls in
// `@/lib/data-api/server-repository`) neutralizes the guard.
vi.mock("server-only", () => ({}));

import {
  formatCoordinates,
  formatSourceDate,
  isSurveillanceSampleId,
  parseSurveillanceCollectionState,
  surveillanceCollectionProfile,
  surveillanceStructuralRql,
  surveillanceViewRecordSchema,
} from "@/lib/surveillance-view";
import { resolveSurveillance } from "@/lib/surveillance-view/server";

describe("Surveillance view contracts", () => {
  it("preserves backend relevance order by default", () => {
    expect(parseSurveillanceCollectionState({}).sort).toBe("unsorted");
    expect(
      parseSurveillanceCollectionState({ sort: "sample_identifier:asc" }).sort,
    ).toBe("sample_identifier:asc");
  });

  it("validates required control fields while retaining additional member fields", () => {
    expect(isSurveillanceSampleId("sample/1")).toBe(true);
    expect(isSurveillanceSampleId("")).toBe(false);
    expect(
      surveillanceViewRecordSchema.parse({
        id: "backend-1",
        sample_identifier: "sample/1",
        pathogen_test_type: ["RAT/antigen"],
        custom_member_field: "retained",
      }),
    ).toMatchObject({ custom_member_field: "retained" });
    expect(() =>
      surveillanceViewRecordSchema.parse({ id: "backend-1" }),
    ).toThrow();
    expect(() =>
      surveillanceViewRecordSchema.parse({
        id: "backend-1",
        sample_identifier: "sample",
        pathogen_test_type: "PCR",
      }),
    ).toThrow();
  });

  it("preserves source date precision and formats valid coordinates", () => {
    expect(formatSourceDate("2024")).toBe("2024");
    expect(formatSourceDate("2024-06")).toBe("2024-06");
    expect(formatSourceDate("2024-06-15T14:30:00Z")).toBe("2024-06-15");
    expect(formatSourceDate("spring 2024")).toBe("spring 2024");
    expect(formatCoordinates("41.8800", "-87.630")).toBe(
      "41.8800° N, 87.630° W",
    );
    expect(formatCoordinates(91, 0)).toBeNull();
    expect(formatCoordinates(undefined, 0)).toBeNull();
    expect(formatCoordinates("   ", 0)).toBeNull();
    expect(formatCoordinates(0, "   ")).toBeNull();
  });

  it("supports repeated friendly facets and explicit RQL precedence", () => {
    const state = parseSurveillanceCollectionState({
      pathogen_test_type: ["PCR", "RAT/antigen", "PCR"],
      collection_country: "US",
      page: "2",
    });
    expect(state.filters.pathogen_test_type).toEqual(["PCR", "RAT/antigen"]);
    expect(state.page).toBe(2);
    expect(surveillanceStructuralRql(state)).toBe(
      'and(eq(collection_country,US),or(eq(pathogen_test_type,"PCR"),eq(pathogen_test_type,"RAT%2Fantigen")))',
    );

    const explicit = parseSurveillanceCollectionState({
      pathogen_test_type: "PCR",
      rql: "eq(collection_country,US)",
    });
    expect(explicit.filters).toEqual({});
    expect(surveillanceStructuralRql(explicit)).toBeUndefined();
    expect(() =>
      parseSurveillanceCollectionState({ rql: "sort(+sample_identifier)" }),
    ).toThrow("Transport operator");
  });

  it("uses backend id for row identity and only adds a unique row discriminator", () => {
    expect(surveillanceCollectionProfile.idField).toBe("id");
    expect(surveillanceCollectionProfile.rowLinkField).toBe(
      "sample_identifier",
    );
    expect(surveillanceCollectionProfile.basePredicate).toBe("eq(id,*)");
    expect(
      surveillanceCollectionProfile.rowHref?.({
        id: "1",
        sample_identifier: "sample/1",
        pathogen_test_type: ["RAT/antigen"],
      }),
    ).toBe("/surveillance/sample%2F1?pathogen_test_type=RAT%2Fantigen");
    expect(
      surveillanceCollectionProfile.rowHref?.({
        id: "2",
        sample_identifier: "sample/2",
        pathogen_test_type: ["PCR", "culture"],
      }),
    ).toBe("/surveillance/sample%2F2");
    expect(surveillanceCollectionProfile.detailFields).toContain(
      "maintenance_medication",
    );
  });
});

describe("resolveSurveillance", () => {
  it("uses typed compound predicates and supports slash-containing test types", async () => {
    const collection = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "1",
          sample_identifier: "sample/1",
          pathogen_test_type: ["RAT/antigen"],
        },
      ],
      total: 1,
      facets: {},
      page: 1,
      pageSize: 2,
    });
    await expect(
      resolveSurveillance({ collection }, "sample/1", "RAT/antigen"),
    ).resolves.toMatchObject({ status: "unique" });
    expect(collection).toHaveBeenCalledWith(
      "surveillance",
      expect.objectContaining({
        rql: 'and(eq(sample_identifier,sample%2F1),eq(pathogen_test_type,"RAT%2Fantigen"))',
        pageSize: 2,
      }),
    );
  });

  it("returns deterministic unique choices for ambiguous samples", async () => {
    const collection = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "2",
          sample_identifier: "sample",
          pathogen_test_type: ["PCR", "culture"],
        },
        {
          id: "1",
          sample_identifier: "sample",
          pathogen_test_type: ["RAT/antigen", "PCR"],
        },
      ],
      total: 3,
      facets: {
        pathogen_test_type: [
          { value: "RAT/antigen", count: 1 },
          { value: "culture", count: 1 },
          { value: "PCR", count: 2 },
        ],
      },
      page: 1,
      pageSize: 2,
    });
    await expect(
      resolveSurveillance({ collection }, "sample"),
    ).resolves.toEqual({
      status: "ambiguous",
      testTypes: ["RAT/antigen", "culture"],
    });
  });

  it("returns no choices when an ambiguous sample has no test type facet", async () => {
    const collection = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "1",
          sample_identifier: "sample",
        },
        {
          id: "2",
          sample_identifier: "sample",
        },
      ],
      total: 2,
      facets: {},
      page: 1,
      pageSize: 2,
    });

    await expect(
      resolveSurveillance({ collection }, "sample"),
    ).resolves.toEqual({
      status: "ambiguous",
      testTypes: [],
    });
  });

  it("distinguishes not found and preserves repository errors", async () => {
    const empty = vi.fn().mockResolvedValue({
      rows: [],
      total: 0,
      facets: {},
      page: 1,
      pageSize: 2,
    });
    await expect(
      resolveSurveillance({ collection: empty }, "missing"),
    ).resolves.toEqual({
      status: "not-found",
    });
    const failure = vi
      .fn()
      .mockRejectedValue(new Error("Surveillance upstream unavailable"));
    await expect(
      resolveSurveillance({ collection: failure }, "sample"),
    ).rejects.toThrow("Surveillance upstream unavailable");
  });
});
