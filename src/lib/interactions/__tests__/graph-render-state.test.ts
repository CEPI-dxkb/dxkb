import { describe, expect, it } from "vitest";
import { edgeStateFor, nodeStateFor } from "../graph-render-state";

const noInputs = {
  selectedNodeIds: new Set<string>(),
  selectedEdgeIds: new Set<string>(),
  focus: null,
};

describe("nodeStateFor", () => {
  it("is all-false with no selection", () => {
    expect(nodeStateFor("a", noInputs)).toEqual({
      isSelected: false,
      isPill: false,
      isFocus: false,
      isDimmed: false,
    });
  });

  it("pills a lone selected node but not a multi-selection", () => {
    const one = { ...noInputs, selectedNodeIds: new Set(["a"]) };
    const two = { ...noInputs, selectedNodeIds: new Set(["a", "b"]) };
    expect(nodeStateFor("a", one)).toMatchObject({
      isSelected: true,
      isPill: true,
    });
    expect(nodeStateFor("a", two)).toMatchObject({
      isSelected: true,
      isPill: false,
    });
  });

  it("dims nodes outside the focus and keeps focus nodes undimmed", () => {
    const inputs = {
      ...noInputs,
      selectedNodeIds: new Set(["a"]),
      focus: { nodes: new Set(["a", "b"]), edges: new Set<string>() },
    };
    expect(nodeStateFor("b", inputs)).toMatchObject({
      isFocus: true,
      isDimmed: false,
    });
    expect(nodeStateFor("z", inputs)).toMatchObject({
      isFocus: false,
      isDimmed: true,
    });
    expect(nodeStateFor("a", inputs)).toMatchObject({
      isSelected: true,
      isDimmed: false,
    });
  });
});

describe("edgeStateFor", () => {
  it("marks focus edges and dims the rest while a focus exists", () => {
    const inputs = {
      ...noInputs,
      focus: { nodes: new Set<string>(), edges: new Set(["e1"]) },
    };
    expect(edgeStateFor("e1", inputs)).toMatchObject({
      isFocus: true,
      isDimmed: false,
    });
    expect(edgeStateFor("e2", inputs)).toMatchObject({
      isFocus: false,
      isDimmed: true,
    });
  });

  it("is all-false with no focus, and flags selected edges", () => {
    expect(edgeStateFor("e1", noInputs)).toEqual({
      isSelected: false,
      isFocus: false,
      isDimmed: false,
    });
    expect(
      edgeStateFor("e1", { ...noInputs, selectedEdgeIds: new Set(["e1"]) })
        .isSelected,
    ).toBe(true);
  });
});
