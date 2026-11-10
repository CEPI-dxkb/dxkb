import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import circular from "graphology-layout/circular";
import random from "graphology-layout/random";

import type { LayoutName } from "./types";

const fa2LayoutOptions = {
  iterations: 100,
  settings: { gravity: 1, scalingRatio: 10, barnesHutOptimize: true },
};

function assignGrid(g: Graph) {
  const perRow = Math.ceil(Math.sqrt(g.order));
  let i = 0;
  g.forEachNode((node) => {
    g.setNodeAttribute(node, "x", i % perRow);
    g.setNodeAttribute(node, "y", Math.floor(i / perRow));
    i += 1;
  });
}

// Port of cytoscape.js's concentric layout (graphology/Sigma has no equivalent).
function assignConcentric(g: Graph) {
  const nodesByDegree = g
    .nodes()
    .map((node) => ({ node, degree: g.degree(node) }))
    .sort((a, b) => b.degree - a.degree);

  let maxDegree = 0;
  for (const { degree } of nodesByDegree) {
    if (degree > maxDegree) maxDegree = degree;
  }
  const levelWidth = Math.max(1, maxDegree / 4);

  const levels: { node: string; degree: number }[][] = [];
  let current: { node: string; degree: number }[] = [];
  let levelOpenDegree = 0;
  for (const entry of nodesByDegree) {
    if (current.length === 0) {
      levelOpenDegree = entry.degree;
      levels.push(current);
    } else if (Math.abs(levelOpenDegree - entry.degree) >= levelWidth) {
      current = [];
      levelOpenDegree = entry.degree;
      levels.push(current);
    }
    current.push(entry);
  }

  const minDist = 1;
  let r = 0;
  for (const level of levels) {
    const n = level.length;
    const dTheta = n > 1 ? (2 * Math.PI) / n : 0;
    if (n > 1) {
      const rMin = minDist / (2 * Math.sin(Math.PI / n));
      r = Math.max(rMin, r);
    }
    level.forEach(({ node }, i) => {
      const angle = i * dTheta;
      g.setNodeAttribute(node, "x", r * Math.cos(angle));
      g.setNodeAttribute(node, "y", r * Math.sin(angle));
    });
    r += minDist;
  }
}

function bfsFrom(g: Graph, root: string, depth: Map<string, number>) {
  depth.set(root, 0);
  const queue = [root];
  let head = 0;
  while (head < queue.length) {
    const node = queue[head];
    head += 1;
    const d = depth.get(node) ?? 0;
    for (const neighbor of g.neighbors(node)) {
      if (!depth.has(neighbor)) {
        depth.set(neighbor, d + 1);
        queue.push(neighbor);
      }
    }
  }
}

function orderRanksByBarycenter(ranks: number[], nodesByRank: Map<number, string[]>, g: Graph) {
  const positionInRank = new Map<string, number>();
  ranks.forEach((rank) => {
    nodesByRank.get(rank)?.forEach((node, i) => positionInRank.set(node, i));
  });

  for (const rank of ranks.slice(1)) {
    const nodesInRank = nodesByRank.get(rank);
    if (!nodesInRank) continue;
    const barycenter = new Map<string, number>();
    nodesInRank.forEach((node) => {
      const neighborPositions = g
        .neighbors(node)
        .map((neighbor) => positionInRank.get(neighbor))
        .filter((pos): pos is number => pos !== undefined);
      const fallback = positionInRank.get(node) ?? 0;
      barycenter.set(
        node,
        neighborPositions.length > 0
          ? neighborPositions.reduce((sum, pos) => sum + pos, 0) / neighborPositions.length
          : fallback,
      );
    });
    nodesInRank.sort((a, b) => (barycenter.get(a) ?? 0) - (barycenter.get(b) ?? 0));
    nodesInRank.forEach((node, i) => positionInRank.set(node, i));
  }
}

function assignDagreLike(g: Graph) {
  const depth = new Map<string, number>();
  for (const root of g.filterNodes((node) => g.inDegree(node) === 0)) {
    if (!depth.has(root)) bfsFrom(g, root, depth);
  }
  g.forEachNode((node) => {
    if (!depth.has(node)) bfsFrom(g, node, depth);
  });

  const nodesByRank = new Map<number, string[]>();
  g.forEachNode((node) => {
    const rank = depth.get(node) ?? 0;
    const bucket = nodesByRank.get(rank);
    if (bucket) bucket.push(node);
    else nodesByRank.set(rank, [node]);
  });
  const sortedRanks = [...nodesByRank.keys()].sort((a, b) => a - b);
  orderRanksByBarycenter(sortedRanks, nodesByRank, g);
  const rankGap = 2;
  let yOffset = 0;
  for (const rank of sortedRanks) {
    const rankNodes = nodesByRank.get(rank) ?? [];
    const perRow = Math.max(1, Math.ceil(Math.sqrt(rankNodes.length)));
    rankNodes.forEach((node, i) => {
      g.setNodeAttribute(node, "x", i % perRow);
      g.setNodeAttribute(node, "y", yOffset + Math.floor(i / perRow));
    });
    yOffset += Math.ceil(rankNodes.length / perRow) + rankGap;
  }
}

function percentile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

export function connectedComponents(g: Graph): string[][] {
  const seen = new Set<string>();
  const components: string[][] = [];
  g.forEachNode((start) => {
    if (seen.has(start)) return;
    const comp: string[] = [];
    const queue = [start];
    seen.add(start);
    let head = 0;
    while (head < queue.length) {
      const node = queue[head];
      head += 1;
      comp.push(node);
      for (const neighbor of g.neighbors(node)) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(comp);
  });
  return components;
}

function translateNodes(g: Graph, nodes: string[], dx: number, dy: number) {
  for (const node of nodes) {
    const attrs = g.getNodeAttributes(node);
    g.setNodeAttribute(node, "x", (attrs.x as number) + dx);
    g.setNodeAttribute(node, "y", (attrs.y as number) + dy);
  }
}

function assignCoseBilkent(g: Graph) {
  forceAtlas2.assign(g, fa2LayoutOptions);

  const comps = connectedComponents(g).map((nodes) => {
    let sumX = 0;
    let sumY = 0;
    for (const node of nodes) {
      const attrs = g.getNodeAttributes(node);
      sumX += attrs.x as number;
      sumY += attrs.y as number;
    }
    const cx = sumX / nodes.length;
    const cy = sumY / nodes.length;
    let radius = 0;
    for (const node of nodes) {
      const attrs = g.getNodeAttributes(node);
      const d = Math.hypot((attrs.x as number) - cx, (attrs.y as number) - cy);
      if (d > radius) radius = d;
    }
    return { nodes, cx, cy, radius };
  });
  if (comps.length === 0) return;

  function placeComponent(comp: (typeof comps)[number], tx: number, ty: number) {
    translateNodes(g, comp.nodes, tx - comp.cx, ty - comp.cy);
  }

  comps.sort((a, b) => b.nodes.length - a.nodes.length);
  const giant = comps[0];
  placeComponent(giant, 0, 0);

  const rest = comps.slice(1);
  if (rest.length === 0) return;

  const giantDists = giant.nodes.map((node) => {
    const attrs = g.getNodeAttributes(node);
    return Math.hypot(attrs.x as number, attrs.y as number);
  });
  const innerRadius = percentile(giantDists, 0.9);

  const outerRadius = innerRadius * 2 + (percentile(rest.map((c) => c.radius), 0.9) || 1);
  const ringArea = Math.PI * (outerRadius * outerRadius - innerRadius * innerRadius);
  const cellArea = ringArea / rest.length;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  rest.forEach((comp, i) => {
    const r = Math.sqrt(innerRadius * innerRadius + ((i + 0.5) * cellArea) / Math.PI);
    const theta = i * goldenAngle;
    placeComponent(comp, r * Math.cos(theta), r * Math.sin(theta));
  });
}

function componentBox(g: Graph, nodes: string[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const attrs = g.getNodeAttributes(node);
    const x = attrs.x as number;
    const y = attrs.y as number;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { nodes, minX, minY, width: maxX - minX, height: maxY - minY };
}

function assignCola(g: Graph) {
  forceAtlas2.assign(g, fa2LayoutOptions);

  const comps = connectedComponents(g).sort((a, b) => b.length - a.length);
  if (comps.length === 0) return;
  const boxes = comps.map((nodes) => componentBox(g, nodes));
  const giantBox = boxes[0];

  function place(box: (typeof boxes)[number], tx: number, ty: number) {
    translateNodes(g, box.nodes, tx - box.minX, ty - box.minY);
  }

  place(giantBox, 0, 0);

  const restBoxes = boxes.slice(1);
  const cols = Math.min(restBoxes.length, Math.max(1, Math.round(Math.sqrt(restBoxes.length) * 2)));
  const step = (giantBox.width * 1.2) / cols;
  const cellFill = 0.55;
  const rowsTop = giantBox.height + step;
  restBoxes.forEach((box, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const target = step * cellFill;
    const scale = Math.max(box.width, box.height) > 0 ? target / Math.max(box.width, box.height) : 1;
    for (const node of box.nodes) {
      const attrs = g.getNodeAttributes(node);
      g.setNodeAttribute(node, "x", box.minX + ((attrs.x as number) - box.minX) * scale);
      g.setNodeAttribute(node, "y", box.minY + ((attrs.y as number) - box.minY) * scale);
    }
    const scaledBox = componentBox(g, box.nodes);
    const cellX = col * step + (step - scaledBox.width) / 2;
    const cellY = rowsTop + row * step + (step - scaledBox.height) / 2;
    place(scaledBox, cellX, cellY);
  });

  g.forEachNode((node) => {
    g.setNodeAttribute(node, "y", -(g.getNodeAttribute(node, "y") as number));
  });
}

export function runGraphLayout(g: Graph, name: LayoutName) {
  if (name === "circular") {
    circular.assign(g, { scale: 100 });
    return;
  }
  if (name === "random") {
    random.assign(g);
    return;
  }
  if (name === "grid") {
    assignGrid(g);
    return;
  }
  if (name === "concentric") {
    assignConcentric(g);
    return;
  }
  if (name === "dagre") {
    assignDagreLike(g);
    return;
  }
  if (name === "cose-bilkent") {
    assignCoseBilkent(g);
    return;
  }
  if (name === "cola") {
    assignCola(g);
    return;
  }
  forceAtlas2.assign(g, fa2LayoutOptions);
}
