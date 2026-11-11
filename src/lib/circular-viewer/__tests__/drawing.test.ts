import type { CircularFeature } from "../contract";
import { buildTrackDrawings, createDrawingCache, hitTest, type TrackData } from "../drawing";
import { heatmapColor } from "../heatmap";
import { spanAt, visibleSegments } from "../hit-test";
import { cursorTarget } from "../keyboard";
import { buildGenomeLayout, offsetAngle, toPolar } from "../layout";
import { baselineRadius, scoreRadius, sectorsPath } from "../paths";
import { defaultTracks, userTrack } from "../tracks";
import { parseUserTrack, type UserPlotType } from "../user-track";

const layout = buildGenomeLayout([{ accession: "A", length: 1000 }]);
const feature = (featureId: string, start: number, end: number): CircularFeature => ({
  featureId, accession: "A", start, end, strand: "+", featureType: "CDS",
});
const byId = (id: string) => {
  const track = defaultTracks().find((item) => item.id === id);
  if (!track) throw new Error(`no default track ${id}`);
  return track;
};

describe("buildTrackDrawings", () => {
  it("draws a feature track as one path and drops features off the genome", () => {
    const data = new Map<string, TrackData>([
      ["cds-forward", { status: "ready", items: { kind: "features", truncated: false, features: [
        feature("F1", 1, 250), feature("F2", 501, 750), { ...feature("F3", 1, 10), accession: "B" },
      ] } }],
    ]);
    const [drawing] = buildTrackDrawings([byId("cds-forward")], data, layout, 300);
    expect(drawing.body.kind).toBe("marks");
    if (drawing.body.kind !== "marks") return;
    expect(drawing.body.layers).toHaveLength(1);
    expect(drawing.body.layers[0].d.match(/M/g)).toHaveLength(2);
    expect(drawing.body.hits?.spans).toHaveLength(2);
  });

  it("shows a pending and a failed track as such", () => {
    const data = new Map<string, TrackData>([
      ["amr", { status: "pending" }],
      ["vf", { status: "error", error: new Error("boom") }],
    ]);
    const drawings = buildTrackDrawings([byId("amr"), byId("vf")], data, layout, 300);
    expect(drawings.map((drawing) => drawing.body.kind)).toEqual(["pending", "failed"]);
  });

  it("labels positions from the layout alone, with guide circles only on scored rings", () => {
    const data = new Map<string, TrackData>([
      ["gc-content", { status: "ready", items: { kind: "scores", points: [
        { accession: "A", start: 0, end: 500, score: 0.4 },
        { accession: "A", start: 500, end: 1000, score: 0.6 },
      ] } }],
    ]);
    const [labels, gc] = buildTrackDrawings([byId("labels"), byId("gc-content")], data, layout, 300);
    expect(labels.body.kind).toBe("labels");
    expect(labels.grid).toEqual([]);
    expect(gc.grid).toHaveLength(3);
    expect(gc.paint).toBe("stroke");
    expect(gc.backgroundPath).not.toBe("");
  });

  it("splits a heatmap into one layer per color", () => {
    const heat = { ...byId("gc-content"), id: "heat", plot: "heatmap" as const, scale: { min: 0, max: 1 } };
    const data = new Map<string, TrackData>([
      ["heat", { status: "ready", items: { kind: "scores", points: [
        { accession: "A", start: 0, end: 100, score: 0.05 },
        { accession: "A", start: 100, end: 200, score: 0.07 },
        { accession: "A", start: 200, end: 300, score: 0.95 },
      ] } }],
    ]);
    const [drawing] = buildTrackDrawings([heat], data, layout, 300);
    if (drawing.body.kind !== "marks") throw new Error("expected marks");
    expect(drawing.body.layers.map((layer) => layer.color)).toEqual(["#FFEBEE", "#B71C1C"]);
  });
});

describe("buildTrackDrawings with a cache", () => {
  const items = { kind: "features" as const, truncated: false, features: [feature("F1", 1, 250)] };
  const data = new Map<string, TrackData>([
    ["cds-forward", { status: "ready", items }],
    ["cds-reverse", { status: "ready", items: { ...items, features: [feature("R1", 501, 750)] } }],
  ]);

  it("keeps an unchanged track's drawing when another track's color changes", () => {
    const cache = createDrawingCache();
    const tracks = [byId("cds-forward"), byId("cds-reverse")];
    const before = buildTrackDrawings(tracks, data, layout, 300, cache);
    const recolored = [tracks[0], { ...tracks[1], foreground: "#123456" }];
    const after = buildTrackDrawings(recolored, new Map(data), layout, 300, cache);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    if (after[1].body.kind !== "marks") throw new Error("expected marks");
    expect(after[1].body.layers[0].color).toBe("#123456");
  });

  it("redraws a track whose answer, layout or radius changed", () => {
    const cache = createDrawingCache();
    const tracks = [byId("cds-forward")];
    const [first] = buildTrackDrawings(tracks, data, layout, 300, cache);
    const [pending] = buildTrackDrawings(tracks, new Map([["cds-forward", { status: "pending" as const }]]), layout, 300, cache);
    expect(pending).not.toBe(first);
    expect(buildTrackDrawings(tracks, new Map(), layout, 300, cache)[0]).toBe(pending);
    const [ready] = buildTrackDrawings(tracks, data, layout, 300, cache);
    expect(buildTrackDrawings(tracks, data, layout, 200, cache)[0]).not.toBe(ready);
    const other = buildGenomeLayout([{ accession: "A", length: 2000 }]);
    expect(buildTrackDrawings(tracks, data, other, 200, cache)[0]).not.toBe(ready);
  });

  it("gives the dark-theme defaults' layers their dark color, and no others", () => {
    const contigs = new Map<string, TrackData>([
      ["contigs", { status: "ready", items: { kind: "contigs", contigs: [{ accession: "A", sequenceId: "s", length: 1000 }] } }],
      ...data,
    ]);
    const drawings = buildTrackDrawings([byId("contigs"), byId("cds-forward")], contigs, layout, 300);
    expect(
      drawings.map((drawing) => (drawing.body.kind === "marks" ? drawing.body.layers.map((layer) => layer.darkColor) : null)),
    ).toEqual([["#9FA8FF"], [null]]);
  });
});

describe("hitTest", () => {
  const data = new Map<string, TrackData>([
    ["cds-forward", { status: "ready", items: { kind: "features", truncated: false, features: [feature("F1", 1, 500)] } }],
  ]);
  const [drawing] = buildTrackDrawings([byId("cds-forward")], data, layout, 300);
  const middle = (drawing.ring.innerRadius + drawing.ring.outerRadius) / 2;

  it("names the feature under the pointer inside its ring", () => {
    const hit = hitTest([drawing], toPolar(middle, 0));
    expect(hit).toMatchObject({ trackId: "cds-forward", item: { kind: "feature", feature: { featureId: "F1" } } });
    expect(hit?.path).toMatch(/^M/);
  });

  it("names a feature at the start of the genome from just left of 12 o'clock", () => {
    const hit = hitTest([drawing], toPolar(-1, -middle));
    expect(hit).toMatchObject({ item: { kind: "feature", feature: { featureId: "F1" } } });
  });

  it("answers nothing outside the ring, past the feature, or on a hidden track", () => {
    expect(hitTest([drawing], toPolar(drawing.ring.outerRadius + 3, 0))).toBeNull();
    expect(hitTest([drawing], toPolar(-middle, 0))).toBeNull();
    expect(hitTest([{ ...drawing, visible: false }], toPolar(middle, 0))).toBeNull();
  });
});

describe("rows past a sequence's end", () => {
  const pastEnd = { accession: "A", start: 1201, end: 1300, score: 0.9 };
  const last = { accession: "A", start: 901, end: 1000, score: 0.2 };
  const scored = () => {
    const track = { ...byId("gc-content"), id: "mine", plot: "histogram" as const, scale: { min: 0, max: 1 } };
    const data = new Map<string, TrackData>([
      ["mine", { status: "ready", items: { kind: "scores", points: [
        { ...last, start: last.start - 1 },
        { ...pastEnd, start: pastEnd.start - 1 },
      ] } }],
    ]);
    return buildTrackDrawings([track], data, layout, 300);
  };

  it("draws no span and no subpath for a region past the end", () => {
    const [drawing] = scored();
    if (drawing.body.kind !== "marks") throw new Error("expected marks");
    expect(drawing.body.hits?.spans).toHaveLength(1);
    expect(drawing.body.layers[0].d.match(/M/g)).toHaveLength(1);
  });

  it("names the real last mark just past the end of the sequence", () => {
    const [drawing] = scored();
    const radius = (drawing.ring.innerRadius + drawing.ring.outerRadius) / 2;
    const hit = hitTest([drawing], toPolar(-0.001, -radius));
    expect(hit).toMatchObject({ item: { kind: "score", point: { score: 0.2 } } });
  });

  it("gives a line plot no vertex for the row past the end", () => {
    const track = { ...byId("gc-content"), id: "mine", plot: "line" as const, scale: { min: 0, max: 1 } };
    const points = (rows: { start: number; score: number }[]) =>
      new Map<string, TrackData>([
        ["mine", { status: "ready", items: { kind: "scores", points: rows.map((row) => ({ accession: "A", end: row.start + 100, ...row })) } }],
      ]);
    const vertices = (rows: { start: number; score: number }[]) => {
      const [drawing] = buildTrackDrawings([track], points(rows), layout, 300);
      if (drawing.body.kind !== "marks") throw new Error("expected marks");
      return drawing.body.layers[0].d.match(/[ML]/g)?.length;
    };
    const kept = [{ start: 0, score: 0.1 }, { start: 900, score: 0.2 }];
    expect(vertices([...kept, { start: 1200, score: 0.9 }])).toBe(vertices(kept));
    expect(vertices([...kept, { start: 1000, score: 0.9 }])).toBe(vertices(kept));
    expect(vertices([...kept, { start: 999, score: 0.9 }])).toBe((vertices(kept) ?? 0) + 1);
  });
});

const uploaded = (text: string, plot: UserPlotType) => {
  const track = userTrack(1, plot, parseUserTrack(text, plot), "upload.tsv", "");
  if (track.source.kind !== "user") throw new Error("expected an upload");
  const data = new Map<string, TrackData>([[track.id, { status: "ready", items: track.source.items }]]);
  const [drawing] = buildTrackDrawings([track], data, layout, 300);
  if (drawing.body.kind !== "marks" || drawing.body.hits === null) throw new Error("expected marks with hover");
  return { track, drawing, body: drawing.body, hits: drawing.body.hits };
};
const at = (offset: number) => offsetAngle(layout, "A", offset) ?? Number.NaN;
const arcRadii = (d: string) =>
  [...d.matchAll(/A([^,]+),/g)].map((match) => Number(match[1])).sort((a, b) => a - b);

describe("an uploaded histogram", () => {
  const { track, drawing, body } = uploaded("A\t1\t500\t0.5\nA\t501\t1000\t-0.25", "histogram");
  const { innerRadius, outerRadius } = drawing.ring;
  const middle = (innerRadius + outerRadius) / 2;
  const scale = { min: -1, max: 1 };
  const baseline = baselineRadius(scale, innerRadius, outerRadius);
  const bar = (start: number, end: number, score: number) =>
    sectorsPath([{ startAngle: at(start), endAngle: at(end) }], baseline, scoreRadius(score, scale, innerRadius, outerRadius));
  const positiveHit = hitTest([drawing], toPolar(middle, 0));
  const negativeHit = hitTest([drawing], toPolar(-middle, 0));

  it("draws a positive score out from the baseline and a negative one in", () => {
    expect(track.scale).toEqual(scale);
    expect(baseline).toBeCloseTo(middle);
    const width = outerRadius - innerRadius;
    const bars = body.layers[0].d.split(/(?=M)/).map(arcRadii);
    expect(bars).toHaveLength(2);
    const [positive, negative] = bars;
    expect(positive[0]).toBeCloseTo(baseline);
    expect(positive[1]).toBeCloseTo(baseline + width / 4);
    expect(negative[0]).toBeCloseTo(baseline - width / 8);
    expect(negative[1]).toBeCloseTo(baseline);
  });

  it("highlights the hovered bar, not the whole ring, wherever in the ring the pointer is", () => {
    expect(positiveHit).toMatchObject({ item: { kind: "score", point: { score: 0.5 } } });
    expect(negativeHit).toMatchObject({ item: { kind: "score", point: { score: -0.25 } } });
    expect(positiveHit?.path).toBe(bar(0, 500, 0.5));
    expect(negativeHit?.path).toBe(bar(500, 1000, -0.25));
    expect(negativeHit?.path).not.toBe(sectorsPath([{ startAngle: at(500), endAngle: at(1000) }], innerRadius, outerRadius));
    expect(`${positiveHit?.path ?? ""}${negativeHit?.path ?? ""}`).toBe(body.layers[0].d);
    expect(hitTest([drawing], toPolar(-(outerRadius - 1), 0))).toEqual(negativeHit);
  });

  it("highlights a zero score as a 1 px bar out from the baseline", () => {
    const zero = uploaded("A\t1\t500\t0\nA\t501\t1000\t-0.5", "histogram");
    expect(zero.track.scale).toEqual({ min: -0.5, max: 0.5 });
    const hit = hitTest([zero.drawing], toPolar(middle, 0));
    expect(hit).toMatchObject({ item: { kind: "score", point: { score: 0 } } });
    const radii = arcRadii(hit?.path ?? "");
    expect(radii[0]).toBeCloseTo(baseline);
    expect(radii[1]).toBeCloseTo(baseline + 1);
  });

  it("gives the keyboard's cursor the same bar highlight", () => {
    const paths = [0, 1].map((position) => cursorTarget([drawing], { trackId: drawing.id, position })?.hit.path);
    expect(paths).toEqual([bar(0, 500, 0.5), bar(500, 1000, -0.25)]);
  });
});

describe("an uploaded heatmap", () => {
  it("paints overlapping rows as hover names them: the row that starts last on top", () => {
    const { drawing, body, hits } = uploaded("A\t1\t50\t0.9\nA\t100\t300\t-0.5\nA\t250\t400\t0.9", "heatmap");
    const { innerRadius, outerRadius } = drawing.ring;
    const hit = hitTest([drawing], { angle: at(275), radius: (innerRadius + outerRadius) / 2 });
    expect(hit).toMatchObject({ item: { kind: "score", point: { start: 249, end: 400, score: 0.9 } } });
    expect(body.layers.map(({ color, d }) => ({ color, d }))).toEqual([
      {
        color: heatmapColor(0.9, 1),
        d: sectorsPath([{ startAngle: at(0), endAngle: at(50) }, { startAngle: at(249), endAngle: at(400) }], innerRadius, outerRadius),
      },
      { color: heatmapColor(-0.5, 1), d: sectorsPath([{ startAngle: at(99), endAngle: at(249) }], innerRadius, outerRadius) },
    ]);
    expect(visibleSegments(hits)).toEqual([
      { index: 0, startAngle: at(0), endAngle: at(50) },
      { index: 1, startAngle: at(99), endAngle: at(249) },
      { index: 2, startAngle: at(249), endAngle: at(400) },
    ]);
  });

  it("shows, at every angle of overlapping sliding windows, the window hover names", () => {
    let text = "";
    for (let start = 1; start + 19 <= 1000; start += 10) {
      text += `A\t${String(start)}\t${String(start + 19)}\t${Math.sin(start / 7).toFixed(3)}\n`;
    }
    const { track, body, hits } = uploaded(text, "heatmap");
    const segments = visibleSegments(hits);
    expect(segments.filter((segment, place) => place > 0 && segment.startAngle < segments[place - 1].endAngle)).toEqual([]);
    const end = at(1000);
    const mismatched = Array.from({ length: 2000 }, (_, step) => ((step + 0.5) / 2000) * end).filter((angle) => {
      const covering = segments.find((segment) => segment.startAngle <= angle && angle < segment.endAngle);
      const hovered = spanAt(hits, angle, 0);
      return covering === undefined || covering.index !== hovered?.index;
    });
    expect(mismatched).toEqual([]);
    const max = track.scale?.max ?? Number.NaN;
    const colors = segments.map((segment) => {
      const item = body.items[segment.index];
      return heatmapColor(item.kind === "score" ? item.point.score : Number.NaN, max);
    });
    const distinct = [...new Set(colors)];
    expect(body.layers.map((layer) => layer.color)).toEqual(distinct);
    expect(body.layers.map((layer) => layer.d.match(/M/g)?.length)).toEqual(
      distinct.map((color) => colors.filter((each) => each === color).length),
    );
  });
});
