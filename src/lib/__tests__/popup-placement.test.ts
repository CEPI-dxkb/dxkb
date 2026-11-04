import { featureCardMinRoom } from "../compare-region/feature-popup";
import {
  placePopup,
  popupMaxWidth,
  popupSide,
  type PopupBounds,
  type PopupBox,
} from "../popup-placement";

/** A 1,000 px wide chart whose figure runs from 100 px down to 800. */
const bounds: PopupBounds = { width: 1000, top: 100, bottom: 800 };
const tooltip = { width: 320, height: 120 };
/** Compare Region's gap from a glyph; the Circular Viewer's pointer uses 12. */
const gap = 6;

function glyph(left: number, right: number, top = 300): PopupBox {
  return { left, top, right, bottom: top + 16 };
}

describe("popupSide", () => {
  it("opens below while the popup fits there", () => {
    // 800 - 8 - (316 + 6) = 470 px below.
    expect(popupSide(glyph(400, 500), bounds, 120, gap)).toEqual({
      below: true,
      room: 470,
    });
  });

  it("opens above where it does not fit below but fits above", () => {
    // No room below; 770 - 6 - 108 = 656 px above.
    expect(popupSide(glyph(400, 500, 770), bounds, 120, gap)).toEqual({
      below: false,
      room: 656,
    });
  });

  it("takes the roomier side where it fits neither", () => {
    // 170 px below, 486 above.
    expect(popupSide(glyph(400, 500, 600), bounds, 500, gap)).toEqual({
      below: false,
      room: 486,
    });
    // 470 px below, 186 above.
    expect(popupSide(glyph(400, 500, 300), bounds, 500, gap)).toEqual({
      below: true,
      room: 470,
    });
  });

  it("gives a tall card the side with a fair room, which its details scroll in", () => {
    const { below, room } = popupSide(
      glyph(400, 500, 300),
      bounds,
      featureCardMinRoom,
      gap,
    );
    expect(below).toBe(true);
    expect(room).toBeGreaterThanOrEqual(featureCardMinRoom);
  });
});

describe("placePopup", () => {
  it("hangs just below and right of the glyph", () => {
    expect(
      placePopup({
        box: glyph(400, 500),
        size: tooltip,
        bounds,
        below: true,
        gap,
      }),
    ).toEqual({ x: 506, y: 322 });
  });

  it("goes left of a glyph with too little room on its right", () => {
    // 806 + 320 runs past 992: its right edge 6 px short of the glyph's left.
    expect(
      placePopup({
        box: glyph(700, 800),
        size: tooltip,
        bounds,
        below: true,
        gap,
      }),
    ).toEqual({ x: 374, y: 322 });
  });

  it("sits above the glyph on the upper side, its bottom 6 px over it", () => {
    expect(
      placePopup({
        box: glyph(400, 500, 700),
        size: tooltip,
        bounds,
        below: false,
        gap,
      }),
    ).toEqual({ x: 506, y: 574 });
  });

  it("hangs under the left end of a gene wider than the room beside it", () => {
    expect(
      placePopup({
        box: glyph(300, 900),
        size: tooltip,
        bounds,
        below: true,
        gap,
      }),
    ).toEqual({ x: 300, y: 322 });
  });

  it("keeps inside its bounds", () => {
    // A tall popup above a gene near the top stops at the figure's top.
    expect(
      placePopup({
        box: glyph(400, 500, 200),
        size: { width: 320, height: 300 },
        bounds,
        below: false,
        gap,
      }),
    ).toEqual({ x: 506, y: 108 });
    // A gene at the right edge, wider than the room: its left end, pulled in.
    expect(
      placePopup({
        box: glyph(500, 1000),
        size: { width: 600, height: 120 },
        bounds,
        below: true,
        gap,
      }),
    ).toEqual({ x: 392, y: 322 });
  });
});

describe("popupMaxWidth", () => {
  it("is the root's width less its margins", () => {
    expect(popupMaxWidth(320)).toBe(304);
    expect(popupMaxWidth(10)).toBe(0);
  });

  it("keeps a popup capped to it wholly inside a phone's chart", () => {
    const narrow: PopupBounds = { width: 320, top: 100, bottom: 800 };
    const width = popupMaxWidth(narrow.width);
    const { x } = placePopup({
      box: glyph(200, 260),
      size: { width, height: 120 },
      bounds: narrow,
      below: true,
      gap,
    });
    expect(x).toBe(8);
    expect(x + width).toBe(312);
  });
});

describe("a pointer's zero-size box, 12 px away", () => {
  const pointer = (x: number, y: number): PopupBox => ({
    left: x,
    top: y,
    right: x,
    bottom: y,
  });

  it("keeps a wide tooltip inside a phone-sized figure from its middle", () => {
    // 357 px wide, the pointer 1 px left of the middle: neither side has room
    // for 270 px, so it is pulled into the margins.
    const figure: PopupBounds = { width: 357, top: 0, bottom: 357 };
    const { x } = placePopup({
      box: pointer(357 / 2 - 1, 100),
      size: { width: 270, height: 80 },
      bounds: figure,
      below: true,
      gap: 12,
    });
    expect(x).toBeGreaterThanOrEqual(8);
    expect(x).toBeLessThanOrEqual(79);
  });

  it("opens 12 px right of and below the pointer where there is room", () => {
    const figure: PopupBounds = { width: 600, top: 0, bottom: 600 };
    expect(
      placePopup({
        box: pointer(100, 100),
        size: { width: 200, height: 80 },
        bounds: figure,
        below: true,
        gap: 12,
      }),
    ).toEqual({ x: 112, y: 112 });
  });

  it("opens above a pointer near the bottom", () => {
    const figure: PopupBounds = { width: 600, top: 0, bottom: 600 };
    expect(popupSide(pointer(100, 560), figure, 80, 12).below).toBe(false);
  });
});
