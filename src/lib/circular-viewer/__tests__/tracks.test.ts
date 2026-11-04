import { gcPoints } from "../track-items";
import { initialTrackState, trackReducer } from "../track-state";
import { defaultTracks, trackDescription } from "../tracks";
import { parseUserTrack } from "../user-track";

describe("default tracks", () => {
  it("are legacy's, outermost first", () => {
    expect(defaultTracks().map((track) => [track.title, track.widthFraction, track.foreground])).toEqual([
      ["Position Label (Mbp)", 0.1, null],
      ["Contigs/Chromosomes", 0.03, "#000F7D"],
      ["CDS - FWD", 0.05, "#307D32"],
      ["CDS - REV", 0.05, "#833B76"],
      ["Non-CDS Features", 0.05, "#21DFD7"],
      ["AMR Genes", 0.05, "#FF0000"],
      ["VF Genes", 0.05, "#FFA500"],
      ["Transporters", 0.05, "#0000FF"],
      ["Drug Targets", 0.05, "#000000"],
      ["GC Content", 0.1, "#000000"],
      ["GC Skew", 0.1, "#000000"],
    ]);
  });

  it("give the defaults under 3:1 on a dark card a lighter version of their color in a dark theme", () => {
    expect(
      defaultTracks()
        .filter((track) => track.darkForeground !== null)
        .map((track) => [track.id, track.darkForeground]),
    ).toEqual([
      ["contigs", "#9FA8FF"],
      ["cds-reverse", "#D88CCB"],
      ["transporter", "#5C8DFF"],
      ["drug-target", "#A6A6A6"],
    ]);
  });

  it("describe GC with the window the server used", () => {
    const gc = defaultTracks().find((track) => track.id === "gc-skew");
    expect(gc && trackDescription(gc, 2000)).toBe("GC Skew - window size: 2000 nt, plot range: -1 - 1");
  });
});

describe("trackReducer", () => {
  it("hides, shows and removes one track, never the contig track", () => {
    let state = trackReducer(initialTrackState(), { type: "toggle", id: "amr" });
    expect(state.tracks.find((track) => track.id === "amr")?.visible).toBe(false);
    state = trackReducer(state, { type: "remove", id: "vf" });
    // Legacy's remove emptied the whole list; only VF goes.
    expect(state.tracks.map((track) => track.id)).not.toContain("vf");
    expect(state.tracks).toHaveLength(10);
    state = trackReducer(state, { type: "remove", id: "contigs" });
    state = trackReducer(state, { type: "toggle", id: "contigs" });
    expect(state.tracks.find((track) => track.id === "contigs")).toMatchObject({ visible: true });
  });

  it("numbers custom tracks, cycles their colors and names them by keyword", () => {
    let state = initialTrackState();
    for (let count = 0; count < 7; count += 1) {
      state = trackReducer(state, {
        type: "addCustom",
        query: { type: "CDS", strand: "both", keyword: `kw${String(count)}` },
        name: count === 0 ? "Secretion" : "",
      });
    }
    const custom = state.tracks.filter((track) => track.source.kind === "custom");
    expect(custom.map((track) => track.foreground)).toEqual([
      "#0000FF", "#008000", "#FFA500", "#FFC0CB", "#FF0000", "#800080", "#0000FF",
    ]);
    // Blue and purple (under 3:1 on a dark card) lighten in a dark theme, green and the rest do not.
    expect(custom.map((track) => track.darkForeground)).toEqual([
      "#5C8DFF", null, null, null, null, "#C08AF5", "#5C8DFF",
    ]);
    expect(custom[0].title).toBe("Secretion");
    expect(custom[1].title).toBe("kw1");
    expect(trackDescription(custom[1])).toBe("Custom track 2 - type: CDS, strand: both, keyword: kw1");
  });

  it("adds user tracks with legacy's look per plot type", () => {
    const parsed = parseUserTrack("A\t1\t10\t3\nA\t11\t20\t-1", "histogram");
    const state = trackReducer(initialTrackState(), {
      type: "addUser", plot: "histogram", parsed, fileName: "scores.tsv", name: "",
    });
    expect(state.tracks.at(-1)).toMatchObject({
      id: "user-1",
      title: "User track 1",
      plot: "histogram",
      widthFraction: 0.1,
      foreground: "#0000FF",
      background: "#FFFFE0",
      scale: { min: -3, max: 3 },
      // Drawn on its own light background, where a lighter blue would fade.
      darkForeground: null,
    });
    expect(trackDescription(state.tracks.at(-1) ?? defaultTracks()[0])).toBe(
      "User track 1 - plot type: histogram, file name: scores.tsv, plot range: -3 - 3",
    );
  });

  it("makes a picked color the color in every theme", () => {
    const state = trackReducer(initialTrackState(), { type: "setForeground", id: "contigs", color: "#123456" });
    expect(state.tracks.find((track) => track.id === "contigs")).toMatchObject({
      foreground: "#123456",
      darkForeground: null,
    });
    expect(state.tracks.find((track) => track.id === "drug-target")?.darkForeground).toBe("#A6A6A6");
  });

  it("clears a custom track's dark color when its color is picked", () => {
    let state = trackReducer(initialTrackState(), {
      type: "addCustom", query: { type: "CDS", strand: "both", keyword: "kw" }, name: "",
    });
    expect(state.tracks.at(-1)).toMatchObject({ foreground: "#0000FF", darkForeground: "#5C8DFF" });
    state = trackReducer(state, { type: "setForeground", id: "custom-1", color: "#123456" });
    expect(state.tracks.at(-1)).toMatchObject({ foreground: "#123456", darkForeground: null });
  });

  it("keeps a heatmap's colors its own", () => {
    const parsed = parseUserTrack("A\t1\t10\t3", "heatmap");
    let state = trackReducer(initialTrackState(), { type: "addUser", plot: "heatmap", parsed, fileName: "h.tsv", name: "Heat" });
    state = trackReducer(state, { type: "setForeground", id: "user-1", color: "#123456" });
    expect(state.tracks.at(-1)?.foreground).toBeNull();
  });
});

describe("track items", () => {
  it("turns GC windows into 0-based score points", () => {
    expect(
      gcPoints({ windowSize: 4, contigs: [{ accession: "A", length: 6, gc: [0.5, 1], skew: [0, -1] }] }, "skew"),
    ).toEqual([
      { accession: "A", start: 0, end: 4, score: 0 },
      { accession: "A", start: 4, end: 6, score: -1 },
    ]);
  });
});
