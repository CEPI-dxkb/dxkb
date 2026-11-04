import { buildGenomeLayout } from "../layout";
import { positionTicks, tickUnit } from "../ticks";

describe("tickUnit", () => {
  it.each([
    [6_000_000, 2_000_000, 100_000],
    [6_000_000, 900_000, 10_000],
    [300_000, 300_000, 10_000],
    [299_999, 299_999, 1_000],
  ])("%i bp (longest %i) ticks every %i bp", (total, longest, unit) => {
    expect(tickUnit(total, longest)).toBe(unit);
  });
});

describe("positionTicks", () => {
  it("ticks a 250 kb sequence every kb, labelling every 10 kb in Mbp", () => {
    const ticks = positionTicks(buildGenomeLayout([{ accession: "A", length: 250_000 }]));
    // A start tick, then indices 1..248 (legacy's loop stops at count - 1).
    expect(ticks).toHaveLength(249);
    expect(ticks[0]).toEqual({ angle: 0, size: "medium" });
    expect(ticks[1].size).toBe("minor");
    expect(ticks[5].size).toBe("medium");
    expect(ticks[10]).toMatchObject({ size: "major", label: "0.01" });
  });

  it("labels a 4.4 Mb chromosome every 100 kb with one decimal", () => {
    const ticks = positionTicks(buildGenomeLayout([{ accession: "A", length: 4_400_000 }]));
    expect(ticks.filter((tick) => tick.label).slice(0, 2).map((tick) => tick.label)).toEqual(["0.1", "0.2"]);
    expect(ticks.find((tick) => tick.label === "1.0")).toBeDefined();
  });
});
