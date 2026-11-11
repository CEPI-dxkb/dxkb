describe("getCuratedLists — env-var override", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.TAXON_VIEW_POLICY_JSON;
  });

  it("returns committed defaults when TAXON_VIEW_POLICY_JSON is unset", async () => {
    const { getCuratedLists } = await import("../curated-lists");
    const lists = getCuratedLists();
    expect(lists.sfvtTaxonIds.has(12637)).toBe(true);
    expect(lists.surveillanceLineageNames.has("Alphainfluenzavirus influenzae")).toBe(true);
  });

  it("uses env-var values when TAXON_VIEW_POLICY_JSON is set", async () => {
    process.env.TAXON_VIEW_POLICY_JSON = JSON.stringify({
      sfvtTaxonIds: [99999],
      surveillanceLineageNames: ["Custom pathogen"],
      serologyLineageNames: ["Custom pathogen"],
    });
    const { getCuratedLists } = await import("../curated-lists");
    const lists = getCuratedLists();
    expect(lists.sfvtTaxonIds.has(99999)).toBe(true);
    expect(lists.sfvtTaxonIds.has(12637)).toBe(false);
    expect(lists.surveillanceLineageNames.has("Custom pathogen")).toBe(true);
  });

  it("falls back to defaults on malformed TAXON_VIEW_POLICY_JSON (logs, does not throw)", async () => {
    process.env.TAXON_VIEW_POLICY_JSON = "{{not valid json";
    const { getCuratedLists } = await import("../curated-lists");
    expect(() => getCuratedLists()).not.toThrow();
    const lists = getCuratedLists();
    expect(lists.sfvtTaxonIds.has(12637)).toBe(true);
  });

  it("merges partial override — omitted keys fall back to defaults", async () => {
    process.env.TAXON_VIEW_POLICY_JSON = JSON.stringify({
      sfvtTaxonIds: [77777],
    });
    const { getCuratedLists } = await import("../curated-lists");
    const lists = getCuratedLists();
    expect(lists.sfvtTaxonIds.has(77777)).toBe(true);
    expect(lists.surveillanceLineageNames.has("Alphainfluenzavirus influenzae")).toBe(true);
  });

  it("coerces string taxon IDs in sfvtTaxonIds array to numbers", async () => {
    process.env.TAXON_VIEW_POLICY_JSON = JSON.stringify({ sfvtTaxonIds: ["12637", "10244"] });
    const { getCuratedLists } = await import("../curated-lists");
    const lists = getCuratedLists();
    expect(lists.sfvtTaxonIds.has(12637)).toBe(true);
    expect(lists.sfvtTaxonIds.has(10244)).toBe(true);
  });

  it("ignores a present-but-wrong-typed key (non-array) and keeps that key's default", async () => {
    process.env.TAXON_VIEW_POLICY_JSON = JSON.stringify({ sfvtTaxonIds: "12637" });
    const { getCuratedLists } = await import("../curated-lists");
    const lists = getCuratedLists();
    expect(lists.sfvtTaxonIds.has(12637)).toBe(true);
    expect(lists.sfvtTaxonIds.has("1" as never)).toBe(false);
  });

  it("keeps valid sibling overrides when one key has a wrong type", async () => {
    process.env.TAXON_VIEW_POLICY_JSON = JSON.stringify({
      sfvtTaxonIds: "12637",
      surveillanceLineageNames: ["Custom pathogen"],
    });
    const { getCuratedLists } = await import("../curated-lists");
    const lists = getCuratedLists();
    expect(lists.sfvtTaxonIds.has(12637)).toBe(true);
    expect(lists.surveillanceLineageNames.has("Custom pathogen")).toBe(true);
  });
});
