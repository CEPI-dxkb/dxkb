import {
  colors,
  edgeAlpha,
  edgeHighlightReducer,
  nodeHighlightReducer,
  renderEdge,
  renderEdgeExperimental,
  renderEdgeHover,
} from "../graph-theme";

// Premultiplied edge colors must converge back to the opaque legend swatch as translucent edges
// stack (~premultRGB / alpha). Convergence is not bit-exact: at ~16% alpha each premultiply
// rounding step maps back to ~±6, so compare within tolerance.
function channels(hex: string): number[] {
  return [0, 1, 2].map((i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16));
}

function convergedChannels(hex8: string, alpha: number): number[] {
  const a = alpha / 255;
  return [0, 1, 2].map((i) =>
    Math.round(parseInt(hex8.slice(1 + i * 2, 3 + i * 2), 16) / a),
  );
}

describe("graph-theme render edges", () => {
  it("keeps both interaction types at the low mesh alpha", () => {
    expect(renderEdge.slice(7)).toBe(edgeAlpha.toString(16).padStart(2, "0"));
    expect(renderEdgeExperimental.slice(7)).toBe(
      edgeAlpha.toString(16).padStart(2, "0"),
    );
  });

  it("converges each rendered edge to its opaque theme color", () => {
    const cases: [string, string][] = [
      [renderEdge, colors.edge],
      [renderEdgeExperimental, colors.edgeExperimental],
    ];
    for (const [rendered, swatch] of cases) {
      const got = convergedChannels(rendered, edgeAlpha);
      const want = channels(swatch);
      got.forEach((v, i) => {
        expect(Math.abs(v - want[i])).toBeLessThanOrEqual(
          Math.ceil(255 / edgeAlpha),
        );
      });
    }
  });

  it("premultiplies the hover edge to a translucent form of the selected color", () => {
    // renderEdgeHover's RGB must converge back to the opaque edgeSelected swatch; higher alpha than
    // the mesh, so tighter tolerance.
    const hoverAlpha = 0x99;
    expect(renderEdgeHover.slice(7)).toBe(
      hoverAlpha.toString(16).padStart(2, "0"),
    );
    const got = convergedChannels(renderEdgeHover, hoverAlpha);
    const want = channels(colors.edgeSelected);
    got.forEach((v, i) => {
      expect(Math.abs(v - want[i])).toBeLessThanOrEqual(
        Math.ceil(255 / hoverAlpha),
      );
    });
  });
});

describe("highlight reducers", () => {
  const baseNode = { color: colors.microbial, size: 2.5 };
  const baseEdge = { color: renderEdge, size: 1 };

  it("raises zIndex, recolors, and flags the selected node highlighted so its label pill persists", () => {
    const reduce = nodeHighlightReducer(new Set(["n1"]));
    expect(reduce("n1", baseNode)).toEqual({
      ...baseNode,
      color: colors.selected,
      zIndex: 1,
      highlighted: true,
    });
  });

  it("leaves unselected nodes untouched (no zIndex, original color)", () => {
    const reduce = nodeHighlightReducer(new Set(["n1"]));
    expect(reduce("n2", baseNode)).toBe(baseNode);
  });

  it("does not highlight a node when an edge is selected", () => {
    const reduce = nodeHighlightReducer(new Set());
    expect(reduce("n1", baseNode)).toBe(baseNode);
  });

  it("raises zIndex, thickens, and recolors the selected edge", () => {
    const reduce = edgeHighlightReducer(new Set(["e1"]));
    expect(reduce("e1", baseEdge)).toEqual({
      ...baseEdge,
      color: colors.edgeSelected,
      size: 2,
      zIndex: 1,
    });
  });

  it("leaves edges untouched when nothing is selected", () => {
    const reduce = edgeHighlightReducer(new Set());
    expect(reduce("e1", baseEdge)).toBe(baseEdge);
  });

  it("tints the hovered edge with the translucent hover color", () => {
    const reduce = edgeHighlightReducer(new Set(), "e1");
    expect(reduce("e1", baseEdge)).toEqual({
      ...baseEdge,
      color: renderEdgeHover,
      size: 2,
      zIndex: 1,
    });
    expect(reduce("e2", baseEdge)).toBe(baseEdge);
  });

  it("selection wins over hover on the same edge", () => {
    const reduce = edgeHighlightReducer(new Set(["e1"]), "e1");
    expect(reduce("e1", baseEdge)).toEqual({
      ...baseEdge,
      color: colors.edgeSelected,
      size: 2,
      zIndex: 1,
    });
  });
});
