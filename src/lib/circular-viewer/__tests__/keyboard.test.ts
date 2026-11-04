import type { CircularFeature } from "../contract";
import { buildTrackDrawings, hitTest, type TrackData } from "../drawing";
import {
  cursorFor,
  cursorTarget,
  firstCursor,
  itemStepKeys,
  stepCursor,
} from "../keyboard";
import { buildGenomeLayout, toPolar } from "../layout";
import { defaultTracks } from "../tracks";

const layout = buildGenomeLayout([{ accession: "A", length: 1000 }]);
const feature = (
  featureId: string,
  start: number,
  end: number,
): CircularFeature => ({
  featureId,
  accession: "A",
  start,
  end,
  strand: "+",
  featureType: "CDS",
});
const byId = (id: string) => {
  const track = defaultTracks().find((item) => item.id === id);
  if (!track) throw new Error(`no default track ${id}`);
  return track;
};
const features = (...items: CircularFeature[]): TrackData => ({
  status: "ready",
  items: { kind: "features", truncated: false, features: items },
});

// Outermost first: labels (skipped), forward CDS, GC line (skipped), pending AMR (skipped), reverse CDS.
const tracks = [
  byId("labels"),
  byId("cds-forward"),
  byId("gc-content"),
  byId("amr"),
  byId("cds-reverse"),
];
const data = new Map<string, TrackData>([
  // Given out of order: the keyboard follows the circle, not the list.
  [
    "cds-forward",
    features(
      feature("F3", 701, 800),
      feature("F1", 1, 100),
      feature("F2", 301, 400),
    ),
  ],
  [
    "gc-content",
    {
      status: "ready",
      items: {
        kind: "scores",
        points: [{ accession: "A", start: 0, end: 1000, score: 0.5 }],
      },
    },
  ],
  ["amr", { status: "pending" }],
  [
    "cds-reverse",
    features(feature("R1", 101, 200), feature("R2", 651, 700)),
  ],
]);
const drawings = buildTrackDrawings(tracks, data, layout, 300);

function featureIdAt(cursor: ReturnType<typeof firstCursor>) {
  const target = cursor ? cursorTarget(drawings, cursor) : null;
  return target?.hit.item.kind === "feature"
    ? target.hit.item.feature.featureId
    : undefined;
}

describe("itemStepKeys", () => {
  it("moves along a ring with Left/Right/Home/End and between rings with Up/Down", () => {
    expect(itemStepKeys).toEqual({
      ArrowLeft: "previous",
      ArrowRight: "next",
      Home: "first",
      End: "last",
      ArrowUp: "outer",
      ArrowDown: "inner",
    });
  });
});

describe("firstCursor", () => {
  it("starts at the first item clockwise from 12 o'clock on the outermost ring with items", () => {
    const cursor = firstCursor(drawings);
    expect(cursor).toEqual({ trackId: "cds-forward", position: 0 });
    expect(featureIdAt(cursor)).toBe("F1");
  });

  it("is null when no ring has items to move between", () => {
    expect(firstCursor(drawings.filter((d) => d.id === "gc-content"))).toBeNull();
    const hidden = buildTrackDrawings(
      [{ ...byId("cds-forward"), visible: false }],
      data,
      layout,
      300,
    );
    expect(firstCursor(hidden)).toBeNull();
  });
});

describe("stepCursor", () => {
  const start = { trackId: "cds-forward", position: 0 };

  it("moves clockwise and back along a ring, wrapping around the circle", () => {
    expect(featureIdAt(stepCursor(drawings, start, "next"))).toBe("F2");
    expect(featureIdAt(stepCursor(drawings, start, "previous"))).toBe("F3");
    const last = { trackId: "cds-forward", position: 2 };
    expect(featureIdAt(stepCursor(drawings, last, "next"))).toBe("F1");
  });

  it("jumps to the ring's first and last item", () => {
    const middle = { trackId: "cds-forward", position: 1 };
    expect(featureIdAt(stepCursor(drawings, middle, "first"))).toBe("F1");
    expect(featureIdAt(stepCursor(drawings, middle, "last"))).toBe("F3");
  });

  it("moves to the nearest item on the next ring in or out that has items", () => {
    // F3 (701..800) skips the GC line and the pending ring; R2 (651..700) is nearest.
    const atF3 = { trackId: "cds-forward", position: 2 };
    const inner = stepCursor(drawings, atF3, "inner");
    expect(inner).toEqual({ trackId: "cds-reverse", position: 1 });
    // From R1 (101..200) back out, F1 (1..100) is nearer than F2 (301..400).
    const atR1 = { trackId: "cds-reverse", position: 0 };
    expect(featureIdAt(stepCursor(drawings, atR1, "outer"))).toBe("F1");
  });

  it("measures nearness around the circle, across 12 o'clock", () => {
    const wrapped = buildTrackDrawings(
      [byId("cds-forward"), byId("cds-reverse")],
      new Map<string, TrackData>([
        ["cds-forward", features(feature("F1", 951, 1000))],
        [
          "cds-reverse",
          features(feature("R1", 1, 50), feature("R2", 801, 850)),
        ],
      ]),
      layout,
      300,
    );
    const next = stepCursor(
      wrapped,
      { trackId: "cds-forward", position: 0 },
      "inner",
    );
    expect(next).toEqual({ trackId: "cds-reverse", position: 0 });
  });

  it("is null past the outermost or innermost ring, and starts over from a lost cursor", () => {
    expect(stepCursor(drawings, start, "outer")).toBeNull();
    const innermost = { trackId: "cds-reverse", position: 0 };
    expect(stepCursor(drawings, innermost, "inner")).toBeNull();
    expect(stepCursor(drawings, null, "next")).toEqual(start);
    expect(
      stepCursor(drawings, { trackId: "gone", position: 0 }, "next"),
    ).toEqual(start);
  });
});

describe("cursorTarget", () => {
  it("is the same hit the pointer gets at the item's middle, with its place on the ring", () => {
    const target = cursorTarget(drawings, { trackId: "cds-forward", position: 1 });
    expect(target).toMatchObject({
      title: "CDS - FWD",
      position: 1,
      count: 3,
    });
    expect(target).not.toBeNull();
    if (!target) throw new Error("no target");
    expect(target.hit).toEqual(
      hitTest(drawings, toPolar(target.x, target.y)),
    );
  });

  it("is null for a cursor whose ring or item is gone", () => {
    expect(cursorTarget(drawings, { trackId: "gone", position: 0 })).toBeNull();
    expect(
      cursorTarget(drawings, { trackId: "cds-forward", position: 3 }),
    ).toBeNull();
    expect(cursorTarget(drawings, { trackId: "amr", position: 0 })).toBeNull();
  });
});

describe("cursorFor", () => {
  it("puts the cursor on the item a pointer hit", () => {
    // F2 (301..400), at 35% of the way round.
    const ring = drawings.find((drawing) => drawing.id === "cds-forward");
    if (!ring) throw new Error("no ring");
    const radius = (ring.ring.innerRadius + ring.ring.outerRadius) / 2;
    const angle = 0.35 * 2 * Math.PI;
    const hit = hitTest(drawings, { angle, radius });
    expect(hit).not.toBeNull();
    if (!hit) throw new Error("no hit");
    expect(cursorFor(drawings, hit)).toEqual({ trackId: "cds-forward", position: 1 });
  });

  it("is null for a hit on a ring the drawings no longer have", () => {
    const target = cursorTarget(drawings, { trackId: "cds-forward", position: 0 });
    if (!target) throw new Error("no target");
    expect(cursorFor(drawings, { ...target.hit, trackId: "gone" })).toBeNull();
    expect(
      cursorFor(drawings, { ...target.hit, item: { ...target.hit.item } }),
    ).toBeNull();
  });
});

