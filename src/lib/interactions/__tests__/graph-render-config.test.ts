// jsdom has no WebGL2, and Sigma 4 reads `WebGL2RenderingContext` constants when its modules load.
vi.hoisted(() => {
  globalThis.WebGL2RenderingContext = {
    BOOL: 0x8b56,
    BYTE: 0x1400,
    UNSIGNED_BYTE: 0x1401,
    SHORT: 0x1402,
    UNSIGNED_SHORT: 0x1403,
    INT: 0x1404,
    UNSIGNED_INT: 0x1405,
    FLOAT: 0x1406,
    HALF_FLOAT: 0x140b,
  } as never;
});

import Graph from "graphology";
import {
  analyzeStyleDeclaration,
  evaluateEdgeStyle,
  evaluateNodeStyle,
  type BaseEdgeState,
  type BaseGraphState,
  type BaseNodeState,
} from "sigma/types";

import {
  buildSigmaOptions,
  primitives,
  type GraphEdgeState,
  type GraphNodeState,
} from "../graph-render-config";
import {
  colors,
  edgeColor,
  edgeDimColor,
  edgeFocusColor,
  edgeFocusExperimentalColor,
  edgeHoverColor,
  nodeDimColor,
} from "../graph-theme";

const options = buildSigmaOptions();
const nodeStyles = options.styles?.nodes;
const edgeStyles = options.styles?.edges;

const baseNodeState: BaseNodeState & GraphNodeState = {
  isHovered: false,
  isLabelHovered: false,
  isHidden: false,
  isHighlighted: false,
  isDragged: false,
  isSelected: false,
  isPill: false,
  isFocus: false,
  isDimmed: false,
};

const baseEdgeState: BaseEdgeState & GraphEdgeState = {
  isHovered: false,
  isLabelHovered: false,
  isHidden: false,
  isHighlighted: false,
  parallelIndex: 0,
  parallelCount: 1,
  isSelected: false,
  isFocus: false,
  isDimmed: false,
};

const graphState: BaseGraphState = {
  isIdle: true,
  isPanning: false,
  isZooming: false,
  isDragging: false,
  hasHovered: false,
  hasHighlighted: false,
};

const graph = new Graph();

// The attributes `buildGraph` gives a node and an edge.
const nodeAttrs = {
  x: 1,
  y: 2,
  size: 2.5,
  color: colors.microbial,
  label: "BAWG_1000",
  labelColor: "#e5e5e5",
};
const edgeAttrs = { size: 1, color: edgeColor, focusColor: edgeFocusColor };

function node(state: Partial<GraphNodeState & BaseNodeState> = {}) {
  return evaluateNodeStyle(
    nodeStyles,
    nodeAttrs,
    { ...baseNodeState, ...state },
    graphState,
    graph,
  );
}

function edge(
  state: Partial<GraphEdgeState & BaseEdgeState> = {},
  attrs: Record<string, unknown> = edgeAttrs,
) {
  return evaluateEdgeStyle(
    edgeStyles,
    attrs,
    { ...baseEdgeState, ...state },
    graphState,
    graph,
  );
}

describe("buildSigmaOptions settings", () => {
  it("sizes items in screen pixels, keeps edges at their own width and turns mouse and touch rotation off", () => {
    expect(options.settings).toMatchObject({
      itemSizesReference: "screen",
      minEdgeThickness: 1,
      renderEdgeLabels: false,
      enableEdgeEvents: true,
      enableCameraRotation: false,
      enableCameraMouseRotation: false,
    });
  });

  it("declares the custom state flags with all-false defaults", () => {
    expect(options.customNodeState).toEqual({
      isSelected: false,
      isPill: false,
      isFocus: false,
      isDimmed: false,
    });
    expect(options.customEdgeState).toEqual({
      isSelected: false,
      isFocus: false,
      isDimmed: false,
    });
  });
});

describe("graph primitives", () => {
  it("draws straight edges only", () => {
    expect(primitives.edges.paths).toHaveLength(1);
    expect(options.primitives).toBe(primitives);
  });

  it("draws every edge layer under every node layer, keeping Sigma's four layer names", () => {
    const layers: readonly string[] = primitives.depthLayers;
    expect(layers).toEqual(
      expect.arrayContaining(["edges", "topEdges", "nodes", "topNodes"]),
    );
    const edgeLayers = layers.filter((layer) => layer.endsWith("Edges") || layer === "edges");
    const nodeLayers = layers.filter((layer) => layer.endsWith("Nodes") || layer === "nodes");
    expect(edgeLayers.length + nodeLayers.length).toBe(layers.length);
    const lastEdge = Math.max(...edgeLayers.map((layer) => layers.indexOf(layer)));
    const firstNode = Math.min(...nodeLayers.map((layer) => layers.indexOf(layer)));
    expect(lastEdge).toBeLessThan(firstNode);
  });
});

describe("graph styles", () => {
  it("depend on item state only, so a pan, zoom or hover re-evaluates no unchanged item", () => {
    expect(analyzeStyleDeclaration(nodeStyles).dependency).toBe("item-state");
    expect(analyzeStyleDeclaration(edgeStyles).dependency).toBe("item-state");
  });

  describe("nodes", () => {
    it("read color, size, label and label color from the attributes when nothing is selected", () => {
      expect(node()).toMatchObject({
        color: colors.microbial,
        size: 2.5,
        label: "BAWG_1000",
        labelColor: "#e5e5e5",
        depth: "nodes",
        labelVisibility: "auto",
        backdropVisibility: "hidden",
      });
    });

    it("draw labels and the pill like v3: 14px Arial, tight label padding, a soft shadow", () => {
      expect(node({ isHovered: true })).toMatchObject({
        labelFont: "Arial",
        labelSize: 14,
        backdropLabelPadding: 2,
        backdropShadowBlur: 7,
        backdropColor: "#ffffff",
      });
    });

    it("paint a lone selected node amber at the top with a dark label in the pill", () => {
      expect(node({ isSelected: true, isPill: true })).toMatchObject({
        color: "#FFAB00",
        depth: "topNodes",
        labelVisibility: "visible",
        backdropVisibility: "visible",
        labelColor: "#000",
      });
    });

    it("keep a selected node that is also in its own focus at the top, amber", () => {
      // `computeSelectionFocus` puts a selected node with neighbours in the focus too; the
      // `isSelected` rule must come after `isFocus` so its depth wins.
      expect(node({ isSelected: true, isPill: true, isFocus: true })).toMatchObject({
        depth: "topNodes",
        color: "#FFAB00",
      });
    });

    it("give no pill to a node in a multi-selection", () => {
      expect(node({ isSelected: true })).toMatchObject({
        color: colors.selected,
        depth: "topNodes",
        labelVisibility: "auto",
        backdropVisibility: "hidden",
        labelColor: "#e5e5e5",
      });
    });

    it("keep a focus node's own color, above the dimmed rest", () => {
      expect(node({ isFocus: true })).toMatchObject({
        color: colors.microbial,
        depth: "focusNodes",
      });
    });

    it("dim a node outside the focus and hide its label", () => {
      expect(node({ isDimmed: true })).toMatchObject({
        color: nodeDimColor,
        labelVisibility: "hidden",
        depth: "nodes",
      });
    });

    it("show a hovered dimmed node's pill with no label", () => {
      expect(node({ isDimmed: true, isHovered: true })).toMatchObject({
        color: nodeDimColor,
        labelVisibility: "hidden",
        backdropVisibility: "visible",
      });
    });

    it("lift a hovered focus node to the top, with a dark label on the white pill", () => {
      expect(node({ isFocus: true, isHovered: true })).toMatchObject({
        depth: "topNodes",
        labelVisibility: "visible",
        backdropVisibility: "visible",
        labelColor: "#000",
      });
    });

    it("keep the selected color on a hovered selected node", () => {
      expect(node({ isSelected: true, isHovered: true })).toMatchObject({
        color: colors.selected,
        depth: "topNodes",
      });
    });
  });

  describe("edges", () => {
    it("read color and size from the attributes when nothing is selected", () => {
      expect(edge()).toMatchObject({
        color: edgeColor,
        size: 1,
        depth: "edges",
      });
    });

    it("thicken and recolor a selected edge at the top", () => {
      expect(edge({ isSelected: true })).toMatchObject({
        color: colors.edgeSelected,
        size: 2,
        depth: "topEdges",
      });
    });

    it("let selection win over hover", () => {
      expect(edge({ isSelected: true, isHovered: true })).toMatchObject({
        color: colors.edgeSelected,
        size: 2,
        depth: "topEdges",
      });
    });

    it("tint a hovered edge with the translucent hover color", () => {
      expect(edge({ isHovered: true })).toMatchObject({
        color: edgeHoverColor,
        size: 2,
        depth: "topEdges",
      });
    });

    it("let hover win over focus", () => {
      expect(edge({ isHovered: true, isFocus: true })).toMatchObject({
        color: edgeHoverColor,
        size: 2,
        depth: "topEdges",
      });
    });

    it("keep a selected edge inside the focus at the selected color", () => {
      expect(edge({ isSelected: true, isFocus: true })).toMatchObject({
        color: colors.edgeSelected,
        size: 2,
        depth: "topEdges",
      });
    });

    it("let selected and hovered edges win over the dim", () => {
      expect(edge({ isSelected: true, isDimmed: true })).toMatchObject({
        color: colors.edgeSelected,
        depth: "topEdges",
      });
      expect(edge({ isHovered: true, isDimmed: true })).toMatchObject({
        color: edgeHoverColor,
        depth: "topEdges",
      });
    });

    it("strengthen a focus edge in its own focus color, experimental edges included", () => {
      expect(edge({ isFocus: true })).toMatchObject({
        color: edgeFocusColor,
        size: 1.5,
        depth: "focusEdges",
      });
      expect(
        edge(
          { isFocus: true },
          { ...edgeAttrs, focusColor: edgeFocusExperimentalColor },
        ),
      ).toMatchObject({ color: edgeFocusExperimentalColor });
    });

    it("dim an edge outside the focus", () => {
      expect(edge({ isDimmed: true })).toMatchObject({
        color: edgeDimColor,
        size: 1,
        depth: "edges",
      });
    });
  });
});
