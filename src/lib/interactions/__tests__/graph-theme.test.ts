import {
  colors,
  edgeAlpha,
  edgeHighlightReducer,
  nodeHighlightReducer,
  renderEdge,
  renderEdgeDim,
  renderEdgeExperimental,
  renderEdgeFocus,
  renderEdgeFocusExperimental,
  renderEdgeHover,
  renderNodeDim,
} from "../graph-theme";
import type { SelectionFocus } from "../selection-focus";

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
      zIndex: 2,
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
      zIndex: 2,
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
      zIndex: 2,
    });
    expect(reduce("e2", baseEdge)).toBe(baseEdge);
  });

  it("selection wins over hover on the same edge", () => {
    const reduce = edgeHighlightReducer(new Set(["e1"]), "e1");
    expect(reduce("e1", baseEdge)).toEqual({
      ...baseEdge,
      color: colors.edgeSelected,
      size: 2,
      zIndex: 2,
    });
  });

  describe("with a selection focus", () => {
    const focus: SelectionFocus = {
      nodes: new Set(["n1", "n2"]),
      edges: new Set(["e1"]),
    };

    it("keeps focused neighbours at their own colour, above the dimmed rest", () => {
      const reduce = nodeHighlightReducer(new Set(["n1"]), focus);
      expect(reduce("n2", baseNode)).toEqual({ ...baseNode, zIndex: 1 });
    });

    it("dims every node outside the focus and drops its label", () => {
      const reduce = nodeHighlightReducer(new Set(["n1"]), focus);
      expect(reduce("n9", baseNode)).toEqual({
        ...baseNode,
        color: renderNodeDim,
        label: null,
        zIndex: 0,
      });
    });

    it("still paints the selected node amber and above its neighbours", () => {
      const reduce = nodeHighlightReducer(new Set(["n1"]), focus);
      expect(reduce("n1", baseNode)).toEqual({
        ...baseNode,
        color: colors.selected,
        zIndex: 2,
        highlighted: true,
      });
    });

    it("strengthens focused edges and keeps experimental edges blue", () => {
      const reduce = edgeHighlightReducer(new Set(), null, focus);
      expect(reduce("e1", { ...baseEdge, experimental: false })).toEqual({
        ...baseEdge,
        experimental: false,
        color: renderEdgeFocus,
        size: 1.5,
        zIndex: 1,
      });
      expect(reduce("e1", { ...baseEdge, experimental: true })).toEqual({
        ...baseEdge,
        experimental: true,
        color: renderEdgeFocusExperimental,
        size: 1.5,
        zIndex: 1,
      });
    });

    it("dims edges outside the focus", () => {
      const reduce = edgeHighlightReducer(new Set(), null, focus);
      expect(reduce("e9", baseEdge)).toEqual({
        ...baseEdge,
        color: renderEdgeDim,
        zIndex: 0,
      });
    });

    it("lets selected and hovered edges win over the dim", () => {
      const reduce = edgeHighlightReducer(new Set(["e9"]), "e8", focus);
      expect(reduce("e9", baseEdge)).toEqual({
        ...baseEdge,
        color: colors.edgeSelected,
        size: 2,
        zIndex: 2,
      });
      expect(reduce("e8", baseEdge)).toEqual({
        ...baseEdge,
        color: renderEdgeHover,
        size: 2,
        zIndex: 2,
      });
    });

    it("does not flag a node highlighted when several are selected", () => {
      const reduce = nodeHighlightReducer(new Set(["n1", "n2"]), focus);
      expect(reduce("n1", baseNode)).toEqual({
        ...baseNode,
        color: colors.selected,
        zIndex: 2,
        highlighted: false,
      });
    });

    it("lets a hovered edge inside the focus keep the hover colour", () => {
      const reduce = edgeHighlightReducer(new Set(), "e1", focus);
      expect(reduce("e1", baseEdge)).toEqual({
        ...baseEdge,
        color: renderEdgeHover,
        size: 2,
        zIndex: 2,
      });
    });

    it("lets a selected edge inside the focus keep the selected colour", () => {
      const reduce = edgeHighlightReducer(new Set(["e1"]), null, focus);
      expect(reduce("e1", baseEdge)).toEqual({
        ...baseEdge,
        color: colors.edgeSelected,
        size: 2,
        zIndex: 2,
      });
    });

    it("leaves everything untouched when the focus is null", () => {
      expect(nodeHighlightReducer(new Set(), null)("n9", baseNode)).toBe(
        baseNode,
      );
      expect(edgeHighlightReducer(new Set(), null, null)("e9", baseEdge)).toBe(
        baseEdge,
      );
    });
  });

  it("pins the dim and focus alpha", () => {
    expect(renderNodeDim.slice(7)).toBe("66");
    expect(renderEdgeDim.slice(7)).toBe("14");
    expect(renderEdgeFocus.slice(7)).toBe("e6");
    expect(renderEdgeFocusExperimental.slice(7)).toBe("e6");
  });

  it("premultiplies the dim colour's RGB by its alpha", () => {
    const want = channels(colors.dim).map((v) => Math.round((v * 0x66) / 255));
    expect(channels(renderNodeDim)).toEqual(want);
  });
});
