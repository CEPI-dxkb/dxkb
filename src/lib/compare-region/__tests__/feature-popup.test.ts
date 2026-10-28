import {
  featureCardMinRoom,
  featurePopupMaxWidth,
  featurePopupSide,
  glyphInView,
  placeFeaturePopup,
  type FeaturePopupBounds,
  type PopupBox,
} from "../feature-popup";

/** A 1,000 px wide chart whose figure runs from 100 px down to 800. */
const bounds: FeaturePopupBounds = { width: 1000, top: 100, bottom: 800 };
/** The plot in view: right of a 200 px label column, under a 30 px ruler. */
const plot: PopupBox = { left: 200, top: 130, right: 1000, bottom: 800 };
const tooltip = { width: 320, height: 120 };

function glyph(left: number, right: number, top = 300): PopupBox {
  return { left, top, right, bottom: top + 16 };
}

describe("glyphInView", () => {
  it("is the glyph while all of it is in view", () => {
    expect(glyphInView(glyph(400, 500), plot)).toEqual(glyph(400, 500));
  });

  it("clips a glyph running under the label column or off the plot", () => {
    expect(glyphInView(glyph(150, 300), plot)).toEqual(glyph(200, 300));
    expect(glyphInView(glyph(900, 1200), plot)).toEqual(glyph(900, 1000));
  });

  it("is null for a glyph under the label column, off the plot or under the ruler", () => {
    expect(glyphInView(glyph(100, 180), plot)).toBeNull();
    expect(glyphInView(glyph(1000, 1100), plot)).toBeNull();
    expect(glyphInView(glyph(400, 500, 110), plot)).toBeNull();
    expect(glyphInView(glyph(400, 500, 800), plot)).toBeNull();
  });
});

describe("featurePopupSide", () => {
  it("opens below while the popup fits there", () => {
    // 800 - 8 - (316 + 6) = 470 px below.
    expect(featurePopupSide(glyph(400, 500), bounds, 120)).toEqual({
      below: true,
      room: 470,
    });
  });

  it("opens above where it does not fit below but fits above", () => {
    // No room below; 770 - 6 - 108 = 656 px above.
    expect(featurePopupSide(glyph(400, 500, 770), bounds, 120)).toEqual({
      below: false,
      room: 656,
    });
  });

  it("takes the roomier side where it fits neither", () => {
    // 170 px below, 486 above.
    expect(featurePopupSide(glyph(400, 500, 600), bounds, 500)).toEqual({
      below: false,
      room: 486,
    });
    // 470 px below, 186 above.
    expect(featurePopupSide(glyph(400, 500, 300), bounds, 500)).toEqual({
      below: true,
      room: 470,
    });
  });

  it("gives a tall card the side with a fair room, which its details scroll in", () => {
    const { below, room } = featurePopupSide(
      glyph(400, 500, 300),
      bounds,
      featureCardMinRoom,
    );
    expect(below).toBe(true);
    expect(room).toBeGreaterThanOrEqual(featureCardMinRoom);
  });
});

describe("placeFeaturePopup", () => {
  it("hangs just below and right of the glyph", () => {
    expect(
      placeFeaturePopup({
        glyph: glyph(400, 500),
        size: tooltip,
        bounds,
        below: true,
      }),
    ).toEqual({ x: 506, y: 322 });
  });

  it("goes left of a glyph with too little room on its right", () => {
    // 806 + 320 runs past 992: its right edge 6 px short of the glyph's left.
    expect(
      placeFeaturePopup({
        glyph: glyph(700, 800),
        size: tooltip,
        bounds,
        below: true,
      }),
    ).toEqual({ x: 374, y: 322 });
  });

  it("sits above the glyph on the upper side, its bottom 6 px over it", () => {
    expect(
      placeFeaturePopup({
        glyph: glyph(400, 500, 700),
        size: tooltip,
        bounds,
        below: false,
      }),
    ).toEqual({ x: 506, y: 574 });
  });

  it("hangs under the left end of a gene wider than the room beside it", () => {
    expect(
      placeFeaturePopup({
        glyph: glyph(300, 900),
        size: tooltip,
        bounds,
        below: true,
      }),
    ).toEqual({ x: 300, y: 322 });
  });

  it("keeps inside its bounds", () => {
    // A tall popup above a gene near the top stops at the figure's top.
    expect(
      placeFeaturePopup({
        glyph: glyph(400, 500, 200),
        size: { width: 320, height: 300 },
        bounds,
        below: false,
      }),
    ).toEqual({ x: 506, y: 108 });
    // A gene at the right edge, wider than the room: its left end, pulled in.
    expect(
      placeFeaturePopup({
        glyph: glyph(500, 1000),
        size: { width: 600, height: 120 },
        bounds,
        below: true,
      }),
    ).toEqual({ x: 392, y: 322 });
  });
});

describe("featurePopupMaxWidth", () => {
  it("is the root's width less its margins", () => {
    expect(featurePopupMaxWidth(320)).toBe(304);
    expect(featurePopupMaxWidth(10)).toBe(0);
  });

  it("keeps a popup capped to it wholly inside a phone's chart", () => {
    const narrow: FeaturePopupBounds = { width: 320, top: 100, bottom: 800 };
    const width = featurePopupMaxWidth(narrow.width);
    const { x } = placeFeaturePopup({
      glyph: glyph(200, 260),
      size: { width, height: 120 },
      bounds: narrow,
      below: true,
    });
    expect(x).toBe(8);
    expect(x + width).toBe(312);
  });
});
