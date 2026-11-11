import { isViewSegment, type ViewRegistry } from "../view-types";

const fixture = {
  genome: { segment: "genome" },
} satisfies ViewRegistry;

describe("isViewSegment", () => {
  it("returns true for a real segment", () => {
    expect(isViewSegment("genome", fixture)).toBe(true);
  });
  it("returns false for an unknown segment", () => {
    expect(isViewSegment("not-a-view", fixture)).toBe(false);
  });
});
