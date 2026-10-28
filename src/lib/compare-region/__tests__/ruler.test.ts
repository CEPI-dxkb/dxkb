import { focusLineX, rulerTicks, trackScale, visibleDomain } from "../ruler";

const identity = { scaleX: 1, translateX: 0 };

function expectCloseTo(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index], 6);
  });
}

describe("trackScale", () => {
  it("maps bp offsets to track pixels under the zoom", () => {
    expect(trackScale([-1000, 1000], identity, 800)(0)).toBe(400);
    const zoomed = trackScale(
      [-1000, 1000],
      { scaleX: 2, translateX: -400 },
      800,
    );
    expect(zoomed(-1000)).toBe(-400);
    expect(zoomed(0)).toBe(400);
  });
});

describe("visibleDomain", () => {
  it("is the window at 1× and the part the zoom shows after", () => {
    expect(visibleDomain([-1000, 1000], identity, 800)).toEqual([-1000, 1000]);
    expectCloseTo(
      visibleDomain([-1000, 1000], { scaleX: 2, translateX: -400 }, 800),
      [-500, 500],
    );
  });
});

describe("rulerTicks", () => {
  it("labels whole bases under half a kilobase a step, with a true minus sign", () => {
    const { major, minor } = rulerTicks([-1000, 1000], identity, 800);
    expect(major.map((tick) => tick.offset)).toEqual([
      -1000, -800, -600, -400, -200, 0, 200, 400, 600, 800, 1000,
    ]);
    expect(major.map((tick) => tick.label)).toEqual([
      "−1,000 bp",
      "−800 bp",
      "−600 bp",
      "−400 bp",
      "−200 bp",
      "0",
      "+200 bp",
      "+400 bp",
      "+600 bp",
      "+800 bp",
      "+1,000 bp",
    ]);
    // U+2212 MINUS SIGN, not a hyphen.
    expect(major[0].label.codePointAt(0)).toBe(0x2212);
    expectCloseTo(
      major.map((tick) => tick.x),
      [0, 80, 160, 240, 320, 400, 480, 560, 640, 720, 800],
    );
    expect(minor).toHaveLength(40);
    expectCloseTo(minor.slice(0, 3), [16, 32, 48]);
  });

  it("labels whole kilobases at a 1 kb step", () => {
    const { major } = rulerTicks([-5000, 5000], identity, 1172);
    expect(major.map((tick) => tick.label)).toEqual([
      "−5 kb",
      "−4 kb",
      "−3 kb",
      "−2 kb",
      "−1 kb",
      "0",
      "+1 kb",
      "+2 kb",
      "+3 kb",
      "+4 kb",
      "+5 kb",
    ]);
    expectCloseTo(
      major.map((tick) => tick.x),
      major.map((_tick, index) => index * 117.2),
    );
  });

  it("follows the zoom: at 20× it ticks the visible 500 bp every 50 bp", () => {
    const { major } = rulerTicks(
      [-5000, 5000],
      { scaleX: 20, translateX: -11720 },
      1172,
    );
    expect(major.map((tick) => tick.label)).toEqual([
      "0",
      "+50 bp",
      "+100 bp",
      "+150 bp",
      "+200 bp",
      "+250 bp",
      "+300 bp",
      "+350 bp",
      "+400 bp",
      "+450 bp",
      "+500 bp",
    ]);
  });

  it("keeps one decimal of a kilobase at a half-kilobase step", () => {
    const { major } = rulerTicks([-2500, 2500], identity, 1100);
    expect(major.map((tick) => tick.label)).toEqual([
      "−2.5 kb",
      "−2.0 kb",
      "−1.5 kb",
      "−1.0 kb",
      "−0.5 kb",
      "0",
      "+0.5 kb",
      "+1.0 kb",
      "+1.5 kb",
      "+2.0 kb",
      "+2.5 kb",
    ]);
  });

  it("steps a 100 kb window by 10 kb", () => {
    const { major } = rulerTicks([-50000, 50000], identity, 1172);
    expect(major[1].offset - major[0].offset).toBe(10000);
    expect(major[0].label).toBe("−50 kb");
  });

  it("asks for at least two major ticks on a narrow plot", () => {
    const { major } = rulerTicks([-1000, 1000], identity, 200);
    expect(major.map((tick) => tick.label)).toEqual(["−1 kb", "0", "+1 kb"]);
  });
});

describe("focusLineX", () => {
  it("is offset 0's x: off the plot's middle when the focus row is off center", () => {
    expect(focusLineX([-500, 1500], identity, 674)).toBe(168.5);
  });
});
