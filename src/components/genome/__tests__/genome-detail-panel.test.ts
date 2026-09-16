import { detailPanelQueryKey } from "../genome-detail-panel-utils";

// Regression: the cache pre-population in list-data.tsx (setQueryData) and the cache
// read in GenomeDetailPanel (useQuery) must use identical keys. If the key format
// diverges between the two call sites, setQueryData writes to a key that useQuery
// never reads — cache miss returns, loading flash comes back.
//
// Both sides now import detailPanelQueryKey from this module (single source of truth).
// This test pins the expected shape so a future refactor that changes the key format
// fails loudly here rather than silently as a UI regression.
describe("detailPanelQueryKey", () => {
  it("returns the expected three-element tuple", () => {
    expect(detailPanelQueryKey("genome_sequence", "94625.28.con.0340")).toEqual(
      ["selected-row", "genome_sequence", "94625.28.con.0340"],
    );
  });

  it("varies by resource so genome and genome_sequence panels cache independently", () => {
    const a = detailPanelQueryKey("genome", "35802.26");
    const b = detailPanelQueryKey("genome_sequence", "35802.26");
    expect(a).not.toEqual(b);
  });

  it("varies by id so different rows cache independently", () => {
    const a = detailPanelQueryKey("genome", "35802.26");
    const b = detailPanelQueryKey("genome", "235.199");
    expect(a).not.toEqual(b);
  });
});
