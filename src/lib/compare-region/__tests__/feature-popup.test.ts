import { glyphInView } from "../feature-popup";
import type { PopupBox } from "@/lib/popup-placement";

const plot: PopupBox = { left: 200, top: 130, right: 1000, bottom: 800 };

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
