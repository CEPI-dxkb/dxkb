import { baselineRadius, gridRadii, polylinesPath, scoreRadius, sectorsPath } from "../paths";

describe("paths", () => {
  it("joins a track's sectors into one path, one subpath each", () => {
    const d = sectorsPath(
      [
        { startAngle: 0, endAngle: Math.PI / 2 },
        { startAngle: Math.PI, endAngle: (3 * Math.PI) / 2 },
      ],
      10,
      20,
    );
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d).toContain("A20,20,0,0,1");
    expect(d).toContain("A10,10,0,0,0");
    expect(sectorsPath([], 10, 20)).toBe("");
  });

  it("draws nothing for a one-point line", () => {
    expect(polylinesPath([[{ angle: 0, radius: 5 }]])).toBe("");
    expect(polylinesPath([[{ angle: 0, radius: 5 }, { angle: 1, radius: 6 }]])).toMatch(/^M.*L/);
  });

  it("maps a score onto the ring as legacy LineTrack did", () => {
    expect(scoreRadius(0.5, { min: 0, max: 1 }, 10, 20)).toBe(15);
    expect(scoreRadius(0, { min: -1, max: 1 }, 10, 20)).toBe(15);
    expect(scoreRadius(-1, { min: -1, max: 1 }, 10, 20)).toBe(10);
    expect(scoreRadius(2, { min: 0, max: 1 }, 10, 20)).toBe(20);
    expect(scoreRadius(3, { min: 0, max: 0 }, 10, 20)).toBe(10);
  });

  it("puts a histogram's baseline at the inner edge or the middle", () => {
    expect(baselineRadius({ min: 0, max: 5 }, 10, 20)).toBe(10);
    expect(baselineRadius({ min: -2, max: 2 }, 10, 20)).toBe(15);
    expect(gridRadii(10, 20)).toEqual([12.5, 15, 17.5]);
  });
});
