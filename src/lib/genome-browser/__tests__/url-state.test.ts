import {
  applyGenomeBrowserUrlState,
  parseGenomeBrowserUrlState,
  viewUrlState,
  writeGenomeBrowserUrlState,
} from "../url-state";

const allTracks = ["refseqs", "PATRICGenes", "RefSeqGenes"] as const;

describe("genome browser URL state", () => {
  it("defaults to all three legacy tracks", () => {
    expect(parseGenomeBrowserUrlState(new URLSearchParams())).toEqual({
      tracks: allTracks,
    });
  });

  it("reads browser.highlight=none as a cleared highlight", () => {
    expect(
      parseGenomeBrowserUrlState(new URLSearchParams("browser.highlight=none"))
        .highlight,
    ).toBeNull();
  });

  it("writes a cleared highlight as browser.highlight=none", () => {
    const params = new URLSearchParams("browser.highlight=A:5..9");
    applyGenomeBrowserUrlState(params, { tracks: [], highlight: null });
    expect(params.get("browser.highlight")).toBe("none");
  });

  it("reads location, tracks and highlight", () => {
    expect(
      parseGenomeBrowserUrlState(
        new URLSearchParams(
          "browser.loc=A:1..100&browser.tracks=PATRICGenes,bogus,PATRICGenes&browser.highlight=A:5..9",
        ),
      ),
    ).toEqual({ location: "A:1..100", tracks: ["PATRICGenes"], highlight: "A:5..9" });
  });

  it("drops a location longer than the URL allows", () => {
    const longRegion = `${"c".repeat(300)}:1..100`;
    const state = parseGenomeBrowserUrlState(
      new URLSearchParams({ "browser.loc": longRegion }),
    );
    expect(state).not.toHaveProperty("location");
    expect(state.tracks).toEqual(allTracks);
  });

  it("reads `none` as every track hidden", () => {
    expect(
      parseGenomeBrowserUrlState(new URLSearchParams("browser.tracks=none")).tracks,
    ).toEqual([]);
  });

  it("writes only what differs from the defaults and keeps other params", () => {
    const params = new URLSearchParams("tab=genome-browser&browser.highlight=old");
    applyGenomeBrowserUrlState(params, { location: "A:1..100", tracks: [...allTracks].reverse() });
    expect(params.toString()).toBe("tab=genome-browser&browser.loc=A%3A1..100");
    applyGenomeBrowserUrlState(params, { location: "A:1..100", tracks: [], highlight: "A:5..9" });
    expect(params.get("browser.tracks")).toBe("none");
    expect(params.get("browser.highlight")).toBe("A:5..9");
  });

  it("reads the URL state off the JBrowse view", () => {
    expect(
      viewUrlState({
        coarseVisibleLocStrings: "ATGO01000001:6,610..13,707",
        tracks: [
          { configuration: { trackId: "PATRICGenes" } },
          { configuration: { trackId: "user-track" } },
        ],
        highlights: [{ refName: "ATGO01000001", start: 9609, end: 10707 }],
      }),
    ).toEqual({
      location: "ATGO01000001:6610..13707",
      tracks: ["PATRICGenes"],
      highlight: "ATGO01000001:9610..10707",
    });
  });

  it("strips every digit separator from a multi-group location", () => {
    expect(
      viewUrlState({
        coarseVisibleLocStrings: "chr1:1,234,567..12,345,678",
        tracks: [],
        highlights: [],
      })?.location,
    ).toBe("chr1:1234567..12345678");
  });

  it("keeps only the first region when the view straddles sequences", () => {
    // JBrowse joins the visible regions with spaces; `ctg1:9000..10000 ctg2`
    // would name no sequence on reload, so the URL carries one whole region.
    expect(
      viewUrlState({
        coarseVisibleLocStrings: "ctg1:9,000..10,000 ctg2:1..500",
        tracks: [],
        highlights: [],
      })?.location,
    ).toBe("ctg1:9000..10000");
  });

  it("omits an oversized location but keeps the tracks and highlight", () => {
    const state = viewUrlState({
      coarseVisibleLocStrings: `${"c".repeat(300)}:1..100`,
      tracks: [{ configuration: { trackId: "RefSeqGenes" } }],
      highlights: [{ refName: "A", start: 4, end: 9 }],
    });
    expect(state).not.toHaveProperty("location");
    expect(state).toEqual({
      tracks: ["RefSeqGenes"],
      highlight: "A:5..9",
    });
  });

  it("omits a highlight longer than the URL carries, as the read side would", () => {
    const state = viewUrlState({
      coarseVisibleLocStrings: "A:1..100",
      tracks: [],
      highlights: [{ refName: "c".repeat(300), start: 4, end: 9 }],
    });
    expect(state).toEqual({ location: "A:1..100", tracks: [] });
  });

  it("writes a cleared highlight as null only where a default would return", () => {
    const view = {
      coarseVisibleLocStrings: "A:1..100",
      tracks: [],
      highlights: [],
    };
    expect(viewUrlState(view)).toEqual({ location: "A:1..100", tracks: [] });
    expect(viewUrlState(view, { hasDefaultHighlight: true })).toEqual({
      location: "A:1..100",
      tracks: [],
      highlight: null,
    });
    expect(
      viewUrlState(
        { ...view, highlights: [{ refName: "A", start: 4, end: 9 }] },
        { hasDefaultHighlight: true },
      )?.highlight,
    ).toBe("A:5..9");
  });

  it("has no URL state before the view shows a region", () => {
    expect(
      viewUrlState({ coarseVisibleLocStrings: "", tracks: [], highlights: [] }),
    ).toBeNull();
  });
});

describe("writeGenomeBrowserUrlState", () => {
  const start = "/genome/1.1?tab=genome-browser&browser.loc=A:1..100#notes";

  beforeEach(() => {
    window.history.replaceState(null, "", start);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes nothing when the URL already shows the view", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const pushState = vi.spyOn(window.history, "pushState");
    writeGenomeBrowserUrlState({ location: "A:1..100", tracks: allTracks });
    expect(replaceState).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("replaces the entry, keeping the other params and the hash readable", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const historyLength = window.history.length;

    writeGenomeBrowserUrlState({
      location: "A:5..9",
      tracks: ["refseqs", "PATRICGenes"],
      highlight: "A:6..7",
    });

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledOnce();
    expect(window.history.length).toBe(historyLength);
    // `:` and `,` stay literal (`toQueryString`), not `%3A` and `%2C`.
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      "/genome/1.1?tab=genome-browser&browser.loc=A:5..9&browser.tracks=refseqs,PATRICGenes&browser.highlight=A:6..7#notes",
    );
  });

  it("drops the defaults it would otherwise write", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=genome-browser&browser.tracks=refseqs&browser.highlight=A:6..7",
    );
    writeGenomeBrowserUrlState({ location: "A:1..100", tracks: allTracks });
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      "/genome/1.1?tab=genome-browser&browser.loc=A:1..100",
    );
  });
});
