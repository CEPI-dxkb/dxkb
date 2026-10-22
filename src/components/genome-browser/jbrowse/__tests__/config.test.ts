import { buildGenomeBrowserConfig, buildGenomeBrowserView } from "../config";
import { buildJBrowseTheme } from "../theme";

const theme = buildJBrowseTheme(
  { primary: "#000001", secondary: "#000002", link: "#000003", background: "#ffffff", card: "#ffffff", foreground: "#000000", chart1: "#111111", chart2: "#222222" },
  "light",
  "Inter",
);

describe("buildGenomeBrowserConfig", () => {
  const config = buildGenomeBrowserConfig({
    genomeId: "470.36849",
    trackColors: { PATRIC: "#111111", RefSeq: "#222222" },
    theme,
  });

  it("names the assembly after the genome, its sequence track `refseqs`", () => {
    expect(config.assembly).toEqual({
      name: "470.36849",
      sequence: {
        type: "ReferenceSequenceTrack",
        trackId: "refseqs",
        name: "Reference Sequence",
        adapter: { type: "BvbrcSequenceAdapter", genomeId: "470.36849" },
      },
    });
  });

  it("declares legacy's two annotation tracks", () => {
    expect(config.tracks.map((track) => [track.trackId, track.name, track.adapter])).toEqual([
      ["PATRICGenes", "PATRIC Annotation", { type: "BvbrcFeatureAdapter", genomeId: "470.36849", annotation: "PATRIC" }],
      ["RefSeqGenes", "RefSeq Annotation", { type: "BvbrcFeatureAdapter", genomeId: "470.36849", annotation: "RefSeq" }],
    ]);
    // JBrowse 5: colors are display-level slots; the v4 `renderer` block is retired.
    expect(config.tracks[0]?.displays).toEqual([
      {
        type: "LinearBasicDisplay",
        displayId: "PATRICGenes-LinearBasicDisplay",
        color: "#111111",
        labels: { description: "jexl:get(feature,'product')" },
      },
    ]);
  });

  it("passes the app theme as JBrowse's theme slot", () => {
    expect(config.configuration).toEqual({ theme });
  });
});

describe("buildGenomeBrowserView", () => {
  it("opens the location with the tracks and highlight the URL named", () => {
    expect(
      buildGenomeBrowserView({
        location: "ATGO01000001:6610..13707",
        tracks: ["refseqs", "PATRICGenes"],
        highlight: "ATGO01000001:9610..10707",
      }),
    ).toEqual({
      loc: "ATGO01000001:6610..13707",
      tracks: ["refseqs", "PATRICGenes"],
      highlight: ["ATGO01000001:9610..10707"],
    });
  });

  it("omits an absent highlight", () => {
    expect(
      buildGenomeBrowserView({ location: "A:1..10", tracks: [] }),
    ).toEqual({ loc: "A:1..10", tracks: [] });
  });
});
