# Porting the BV-BRC "Interactions" Graph to React / Next.js

A build guide for recreating the Taxon-View **Interactions** page (protein-protein
interaction network) in a fresh React + Next.js app. Two parallel implementations
are given so you can build both and pick:

1. **react-cytoscapejs** — one-to-one port, keeps every existing feature.
2. **Sigma.js + graphology** — WebGL renderer, algorithms from graphology.

The first half (data model, API, shared UI contract) is renderer-agnostic —
build it once. The renderer-specific halves come after.

---

## 0. What the current page actually is

Source of truth in the legacy Dojo app:

| Concern | Legacy file |
|---|---|
| Data fetch (RQL → `/ppi/`) | `public/js/p3/store/InteractionMemoryStore.js` |
| Taxon-view wrapper (Table + Graph tabs) | `public/js/p3/widget/InteractionsContainer.js` |
| Table grid | `public/js/p3/widget/InteractionGrid.js` + `InteractionGridContainer.js` |
| **Graph (Cytoscape)** | `public/js/p3/widget/InteractionGraphContainer.js` |
| Node/edge builders + hub/subgraph algorithms | `public/js/p3/widget/InteractionOps.js` |
| Query build + Bacteria gate | `public/js/p3/widget/viewer/Taxonomy.js` |

This guide targets the **Graph** panel. The Table is a normal data grid — port it
with TanStack Table separately; it shares the same fetch layer described in §2.

### Feature checklist (what "done" means)

The graph panel must reproduce:

- [ ] Force-directed network of proteins (nodes) and interactions (edges)
- [ ] Node coloring: microbial protein / host protein / selected / pinned / molecule
- [ ] Edge coloring: predicted (gray) vs experimentally verified (indigo)
- [ ] Hover tooltip (node: BRC ID, genome, locus, gene, product; edge: type, method, evidence)
- [ ] Multiple layouts: COLA, cose-bilkent, dagre, grid, concentric, circle, random
- [ ] Right-click context menu: select neighborhood, select connected subgraph
- [ ] Toolbar: **Sub-Graph** (≥N nodes / largest), **Hub Protein** (≥N neighbors / most connected)
- [ ] Box / multi-select → detail panel + action bar
- [ ] Actions on selection: view Feature, FeatureList, FASTA, MSA, add to Group
- [ ] PNG export
- [ ] Legend
- [ ] "Pinned" feature highlighting (the feature you navigated in from)

---

## 1. Next.js project setup

```bash
npx create-next-app@latest bvbrc-interactions --typescript --app
cd bvbrc-interactions
```

**Critical SSR caveat:** both Cytoscape and Sigma touch `window`/`document` at
module load. They must never run on the server. Every graph component is loaded
with `next/dynamic` + `ssr: false`, or gated behind a `useEffect`.

```tsx
// app/view/taxonomy/[id]/interactions/page.tsx
import dynamic from 'next/dynamic';

const InteractionsGraph = dynamic(
  () => import('@/components/interactions/InteractionsGraph'),
  { ssr: false, loading: () => <div>Loading graph…</div> }
);

export default function Page({ params }: { params: { id: string } }) {
  return <InteractionsGraph taxonId={params.id} />;
}
```

Recommended layout: keep the fetch layer (§2) and shared UI (§4) in plain
modules; only the `cytoscape`/`sigma` instance lives inside the `ssr:false`
component.

---

## 2. Data layer (shared — build once)

### 2.1 The endpoint

The graph pulls from the BV-BRC Data API `ppi` core. Legacy call
(`InteractionMemoryStore.js:59-95`):

- **URL:** `POST {dataAPI}/ppi/`
- **Headers:** `Accept: application/json`, `Content-Type: application/rqlquery+x-www-form-urlencoded`
- **Body:** the RQL query string
- **Paging:** `Range: items=0-5000` header (legacy fetches a single 5000-row page; `numFound` paging is stubbed out)

Legacy first fires a `&limit(1)` probe, then the real ranged fetch. You can skip
the probe — just do the ranged fetch.

### 2.2 The query

Built in `Taxonomy.js:347-361`. For the Interactions tab `prop = 'genome_id_a'`:

```
eq(genome_id_a,*)&genome(to(genome_id_a),eq(taxon_lineage_ids,<TAXON_ID>))
```

Plus the default filter (`InteractionGridContainer.js:55`):

```
&eq(evidence,experimental)
```

Meaning: all PPI rows whose interactor-A genome belongs to any genome under this
taxon lineage, filtered to experimental evidence by default. Facet filters append
more `&eq(field,value)` clauses.

### 2.3 ppi record fields (what a row contains)

From the grid columns, download map (`InteractionGridContainer.js:108-121`), and
node builder (`InteractionOps.js:5-19`):

```ts
// types/ppi.ts
export interface PpiRecord {
  id: string;
  // Interactor A
  interactor_a: string;
  interactor_type_a: string;      // e.g. "Protein"
  interactor_desc_a: string;
  feature_id_a: string;
  gene_a?: string;
  genome_id_a: string;
  genome_name_a: string;
  refseq_locus_tag_a?: string;
  domain_a: string;               // "Bacteria" | "Archaea" | host domain
  taxon_id_a?: number;
  // Interactor B (same shape, _b)
  interactor_b: string;
  interactor_type_b: string;
  interactor_desc_b: string;
  feature_id_b: string;
  gene_b?: string;
  genome_id_b: string;
  genome_name_b: string;
  refseq_locus_tag_b?: string;
  domain_b: string;
  taxon_id_b?: number;
  // Interaction metadata
  category: string;
  interaction_type: string;
  detection_method: string;
  evidence: string;               // contains "experimental" when lab-verified
  pmid?: string[];
  source_db: string;
  source_id?: string;
  score?: number;
}
```

### 2.4 Fetch hook (Next.js route proxy + client hook)

Proxy the API through a Next route handler to avoid CORS and hide the base URL,
mirroring the legacy `/api/` Express proxy.

```ts
// app/api/ppi/route.ts
const DATA_API = process.env.BVBRC_DATA_API!; // e.g. https://www.bv-brc.org/api

export async function POST(req: Request) {
  const rql = await req.text();
  const res = await fetch(`${DATA_API}/ppi/`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/rqlquery+x-www-form-urlencoded',
      Range: 'items=0-5000',
    },
    body: rql,
  });
  const data = await res.json();
  return Response.json(data);
}
```

```ts
// lib/useInteractions.ts
import useSWR from 'swr';
import type { PpiRecord } from '@/types/ppi';

function buildQuery(taxonId: string, filter = 'eq(evidence,experimental)') {
  const base = `eq(genome_id_a,*)&genome(to(genome_id_a),eq(taxon_lineage_ids,${taxonId}))`;
  return filter ? `${base}&${filter}` : base;
}

export function useInteractions(taxonId: string, filter?: string) {
  const query = buildQuery(taxonId, filter);
  return useSWR<PpiRecord[]>(['ppi', query], async () => {
    const res = await fetch('/api/ppi', { method: 'POST', body: query });
    return res.json();
  });
}
```

> `useSWR` gives caching + dedupe for free — replaces the hand-rolled
> `_loadingDeferred` memo in `InteractionMemoryStore.js:38`.

---

## 3. Data → graph transform (shared — build once)

Both renderers need the same node/edge derivation. Port of
`InteractionOps.createInteractorCyEle` (`InteractionOps.js:5-19`) plus the edge
rule from `InteractionGraphContainer.js:757`.

```ts
// lib/toGraph.ts
import type { PpiRecord } from '@/types/ppi';

const PATHOGEN_DOMAINS = ['Bacteria', 'Archaea'];

export interface GNode {
  id: string;
  interactor_type: string;
  interactor_desc: string;
  feature_id: string;
  gene?: string;
  genome?: string;
  refseq_locus_tag?: string;
  kind: 'microbial' | 'host';   // drives color
}

export interface GEdge {
  id: string;
  source: string;
  target: string;
  evidence: string;
  interaction_type: string;
  detection_method: string;
  experimental: boolean;         // drives color
}

function nodeFrom(d: PpiRecord, ab: 'a' | 'b'): GNode {
  const domain = d[`domain_${ab}` as const];
  return {
    id: d[`interactor_${ab}` as const],
    interactor_type: d[`interactor_type_${ab}` as const],
    interactor_desc: d[`interactor_desc_${ab}` as const],
    feature_id: d[`feature_id_${ab}` as const],
    gene: d[`gene_${ab}` as const],
    genome: d[`genome_name_${ab}` as const],
    refseq_locus_tag: d[`refseq_locus_tag_${ab}` as const],
    kind: PATHOGEN_DOMAINS.includes(domain) ? 'microbial' : 'host',
  };
}

export function toGraph(rows: PpiRecord[]) {
  const nodes = new Map<string, GNode>();
  const edges: GEdge[] = [];
  for (const d of rows) {
    if (!nodes.has(d.interactor_a)) nodes.set(d.interactor_a, nodeFrom(d, 'a'));
    if (!nodes.has(d.interactor_b)) nodes.set(d.interactor_b, nodeFrom(d, 'b'));
    edges.push({
      id: d.id,
      source: d.interactor_a,
      target: d.interactor_b,
      evidence: d.evidence,
      interaction_type: d.interaction_type,
      detection_method: d.detection_method,
      experimental: (d.evidence || '').includes('experimental'),
    });
  }
  return { nodes: [...nodes.values()], edges };
}
```

### Shared color constants

Pulled from the Cytoscape stylesheet (`InteractionGraphContainer.js:429-515`) and
legend (`:616-636`):

```ts
// lib/graphTheme.ts
export const COLORS = {
  microbial: '#90CAF9',   // blue 200
  host: '#A5D6A7',        // green 200
  selected: '#FFAB00',
  pinned: '#F44336',
  molecule: '#FFAB91',    // orange 200 (non-protein interactors)
  edge: '#555555',
  edgeExperimental: '#3F51B5', // indigo 500
  edgeSelected: '#BBBB55',
};
```

---

## 4. Shared UI shell (renderer-agnostic)

Both versions plug their canvas into the same shell:

```
┌─────────────────────────────────────────────┐
│ Toolbar: Export · Sub-Graph · Hub · Layout   │  ← top
├──────────┬───────────────────────┬───────────┤
│ Legend   │      GRAPH CANVAS      │ Detail    │
│ (left)   │      (center)         │ panel     │
│          │                       │ (right)   │
└──────────┴───────────────────────┴───────────┘
```

Component tree:

```
<InteractionsGraph>            // owns SWR fetch + selection state
  <GraphToolbar />             // layout picker, hub/subgraph, export
  <GraphLegend />              // static SVG legend
  <GraphCanvas />              // ← renderer-specific (cytoscape OR sigma)
  <DetailPanel selection={} /> // node/edge details + action buttons
```

Selection state lives in the parent so the detail panel and toolbar don't care
which renderer is mounted:

```tsx
const [selection, setSelection] = useState<{nodes: GNode[]; edges: GEdge[]}>({nodes: [], edges: []});
```

The Next port departs from this sketch so Back from a linked feature page restores
the view: a single selected node or edge lives in the URL
(`interactionsGraph.node` / `interactionsGraph.edge`, beside the subview, the
shared keyword, the layout and the camera), and only multi-item picks (Sub-Graph,
Hub, or a Cmd/Ctrl-built set) are local state. See
"Interactions" in `docs/architecture.md`.

### Legend (static, shared)

```tsx
// components/interactions/GraphLegend.tsx  — port of InteractionGraphContainer.js:616
export function GraphLegend() {
  return (
    <svg width={150} height={140} style={{ fontSize: 10 }}>
      <circle cx={10} cy={10} r={10} fill="#90CAF9" /><text x={30} y={15}>Microbial protein</text>
      <circle cx={10} cy={35} r={10} fill="#A5D6A7" /><text x={30} y={40}>Host protein</text>
      <circle cx={10} cy={60} r={10} fill="#FFAB00" /><text x={30} y={65}>Selected</text>
      <line x1={0} y1={85} x2={20} y2={85} strokeWidth={3} stroke="#555" /><text x={30} y={90}>Predicted interaction</text>
      <line x1={0} y1={110} x2={20} y2={110} strokeWidth={3} stroke="#3F51B5" /><text x={30} y={115}>Experimentally verified</text>
    </svg>
  );
}
```

### Detail panel + actions

Port of the selection actions (`InteractionGraphContainer.js:190-397`). These are
just links/buttons that navigate or open dialogs — renderer-independent. Map each
legacy Topic.publish('/navigate') to a Next router push:

| Action | Target |
|---|---|
| View Feature | `/view/Feature/{feature_id}#view_tab=overview` (shipped as links, see below) |
| View FeatureList | `/view/FeatureList/?in(feature_id,(…))#view_tab=features` |
| View FASTA (DNA/Protein) | `/view/FASTA/{dna|protein}/?in(feature_id,(…))` |
| MSA (2–200 features) | `/view/MSA/?in(feature_id,(…))` |
| Add to Group | opens group dialog (auth required) |

The Next port does not expose "View Feature" as an action-bar action. It ships as
links instead. In the details pane, a selected node's BRC ID and Gene link to
`/feature/{feature_id}` and its Genome links to `/genome/{genome_id}`, and the
From/To endpoints of a selected edge link to their feature pages. The pane never
links a host node, and links a genome only when its id passes `isGenomeId`. The
Interactions table links the same features and genomes in its cells, but applies
neither check: it links a non-empty cell whenever the row has the feature or genome
id its template needs. The links go straight to the current `/feature/…` and
`/genome/…` routes, not the legacy `/view/Feature/…` path.

```tsx
// selection → unique feature_ids (nodes are proteins; skip molecules)
const featureIds = selection.nodes
  .filter(n => n.interactorType === 'Protein')
  .map(n => n.featureId);
```

---

## 5. IMPLEMENTATION A — react-cytoscapejs

**Goal:** one-to-one port. Nearly every legacy line maps to a Cytoscape call, so
this is the lowest-risk path.

### 5.1 Install

```bash
npm i cytoscape react-cytoscapejs
npm i cytoscape-cola cytoscape-dagre cytoscape-cose-bilkent cytoscape-context-menus
npm i -D @types/cytoscape
```

### 5.2 Register extensions (once, client-side)

```ts
// lib/cytoscapeSetup.ts
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import dagre from 'cytoscape-dagre';
import coseBilkent from 'cytoscape-cose-bilkent';
import contextMenus from 'cytoscape-context-menus';
import 'cytoscape-context-menus/cytoscape-context-menus.css';

let registered = false;
export function registerCytoscape() {
  if (registered) return;
  cytoscape.use(cola);
  cytoscape.use(dagre);
  cytoscape.use(coseBilkent);
  contextMenus(cytoscape);
  registered = true;
}
```

### 5.3 The canvas component

Direct port of `InteractionGraphContainer.js:426-611`.

```tsx
// components/interactions/cyto/CytoCanvas.tsx
'use client';
import { useEffect, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import type { Core, ElementDefinition } from 'cytoscape';
import { registerCytoscape } from '@/lib/cytoscapeSetup';
import { COLORS } from '@/lib/graphTheme';
import type { GNode, GEdge } from '@/lib/toGraph';

registerCytoscape();

const stylesheet: cytoscape.Stylesheet[] = [
  { selector: 'node', style: {
      label: 'data(gene)', 'text-opacity': 0.8, 'text-valign': 'center',
      'text-halign': 'center', 'font-size': 10, width: 40, height: 40,
      'background-color': COLORS.microbial } },
  { selector: 'node:selected', style: {
      'border-color': COLORS.selected, 'border-width': 2, 'border-opacity': 0.8,
      'background-color': COLORS.selected } },
  { selector: 'node.pinned', style: {
      width: 45, height: 45, 'font-size': 12, 'background-color': COLORS.pinned } },
  { selector: 'node.host', style: { 'font-size': 9, 'background-color': COLORS.host } },
  { selector: 'node.molecule', style: {
      shape: 'roundrectangle', 'background-color': COLORS.molecule } },
  { selector: 'edge', style: {
      width: 3, 'line-color': COLORS.edge, 'curve-style': 'bezier' } },
  { selector: 'edge:selected', style: { 'line-color': COLORS.edgeSelected } },
  { selector: 'edge.typeA', style: { 'line-color': COLORS.edgeExperimental } },
];

function toElements(nodes: GNode[], edges: GEdge[], pins: string[]): ElementDefinition[] {
  // Pins are feature IDs; node IDs are interactor IDs and may differ.
  const nodeEls = nodes.map(n => ({
    data: { ...n },
    classes: [
      n.kind === 'host' ? 'host' : '',
      n.interactorType !== 'Protein' ? 'molecule' : '',
      pins.includes(n.featureId) ? 'pinned' : '',
    ].filter(Boolean).join(' '),
  }));
  const edgeEls = edges.map(e => ({
    data: { id: e.id, source: e.source, target: e.target,
            evidence: e.evidence, interaction_type: e.interactionType,
            detection_method: e.detectionMethod },
    classes: e.experimental ? 'typeA' : '',
  }));
  return [...nodeEls, ...edgeEls];
}

export function CytoCanvas({ nodes, edges, pins, onSelect, cyRef }: {
  nodes: GNode[]; edges: GEdge[]; pins: string[];
  onSelect: (sel: { nodes: GNode[]; edges: GEdge[] }) => void;
  cyRef: React.MutableRefObject<Core | null>;
}) {
  const elements = toElements(nodes, edges, pins);

  return (
    <CytoscapeComponent
      elements={elements}
      stylesheet={stylesheet}
      style={{ width: '100%', height: '100%' }}
      boxSelectionEnabled
      cy={(cy: Core) => {
        cyRef.current = cy;

        // context menu — port of :519-558
        (cy as any).contextMenus({ menuItems: [
          { id: 'neighborhood', content: 'select Neighborhood', selector: 'node',
            onClickFunction: (e: any) => { cy.nodes().unselect(); e.target.neighborhood().select(); } },
          { id: 'subgraph', content: 'select Connected Sub-graph', selector: 'node',
            onClickFunction: (e: any) => {
              cy.nodes().unselect();
              const visited: any[] = [];
              cy.elements().bfs({ roots: e.target, directed: false,
                visit: (v, ed) => { visited.push(v); if (ed) visited.push(ed); } });
              cy.collection(visited).select();
            } },
        ]});

        // selection → parent (debounced like :604-611)
        let t: any;
        cy.on('select unselect', 'node, edge', () => {
          clearTimeout(t);
          t = setTimeout(() => {
            const sel = cy.elements(':selected');
            onSelect({
              nodes: sel.nodes().map(n => n.data() as GNode),
              edges: sel.edges().map(ed => ed.data() as GEdge),
            });
          }, 300);
        });

        cy.layout({ name: 'cola', fit: true } as any).run();
      }}
    />
  );
}
```

> Tooltips: legacy uses a hand-positioned `<div class="tooltip">`
> (`:561-599`). In React, subscribe to `cy.on('mouseover','node,edge', …)` and set
> a state-driven tooltip, or use a lib like `tippy.js` (`cytoscape-popper`). Same
> content: node → BRC ID/genome/locus/gene/product; edge → type/method/evidence.

### 5.4 Layouts (toolbar)

The 7 layouts map directly (`:171-178`). COLA needs its one-off option:

```ts
export function runLayout(cy: Core, name: string) {
  const opts: any = name === 'cola' ? { name: 'cola', userConstIter: 1 } : { name };
  cy.layout(opts).run();
}
// names: 'cola' | 'cose-bilkent' | 'dagre' | 'grid' | 'random' | 'concentric' | 'circle'
```

### 5.5 Hub / Sub-Graph selection

Port `InteractionOps.getHubs` / `getSubGraphs` verbatim — they operate on the live
`cy` instance (Cytoscape's `bfs`, `dijkstra`, `connectedEdges` still exist). Copy
`InteractionOps.js:71-176` into a `lib/interactionOps.ts`, drop the `console.time`
lines, and call:

```ts
import { getHubs, getSubGraphs } from '@/lib/interactionOps';
// toolbar handler:
cy.elements().unselect();
cy.collection(getSubGraphs(cy, '5')).select();   // "5 or More Nodes"
cy.collection(getHubs(cy, '3')).select();        // "3 or More Neighbors"
```

This is the **big win** of the Cytoscape path: the algorithms come across
unchanged.

### 5.6 PNG export (`:94`)

```ts
const png = cy.png({ full: true, scale: 1 });
const a = document.createElement('a');
a.href = png; a.download = 'BVBRC_interaction.png'; a.click();
```

### 5.7 Effort estimate

| Piece | Effort |
|---|---|
| Canvas + styling | Low (copy stylesheet) |
| Layouts | Trivial |
| Hub/subgraph/neighborhood | **Trivial (verbatim copy)** |
| Context menu | Low (extension exists) |
| Tooltip / detail panel | Medium (React-ify) |
| PNG export | Trivial |

**Overall: LOW.** Highest fidelity, least new code.

---

## 6. IMPLEMENTATION B — Sigma.js + graphology

**Goal:** WebGL rendering for large graphs. You gain scale; you rebuild the
interaction tooling on top of graphology (which supplies the graph algorithms).

### 6.1 Install

```bash
npm i sigma graphology graphology-layout-forceatlas2 graphology-layout
npm i graphology-traversal graphology-metrics @react-sigma/core
npm i -D @types/graphology
```

- `sigma` — WebGL renderer
- `graphology` — graph data structure + algorithms
- `graphology-layout-forceatlas2` — force layout (Sigma's default equivalent to COLA)
- `graphology-traversal` — BFS/DFS (for subgraph selection)
- `@react-sigma/core` — React bindings (`<SigmaContainer>`, hooks)

### 6.2 Build the graphology graph

```ts
// lib/toGraphology.ts
import Graph from 'graphology';
import { COLORS } from '@/lib/graphTheme';
import type { GNode, GEdge } from '@/lib/toGraph';

export function buildGraph(nodes: GNode[], edges: GEdge[], pins: string[]) {
  const g = new Graph({ multi: true });
  for (const n of nodes) {
    const pinned = pins.includes(n.featureId);
    g.addNode(n.id, {
      label: n.gene || n.id,
      size: pinned ? 8 : 6,
      color: pinned ? COLORS.pinned
           : n.kind === 'host' ? COLORS.host : COLORS.microbial,
      x: Math.random(), y: Math.random(),  // forceatlas2 needs initial coords
      ...n,
    });
  }
  for (const e of edges) {
    g.addEdgeWithKey(e.id, e.source, e.target, {
      size: 2,
      color: e.experimental ? COLORS.edgeExperimental : COLORS.edge,
      ...e,
    });
  }
  return g;
}
```

### 6.3 The canvas component

```tsx
// components/interactions/sigma/SigmaCanvas.tsx
'use client';
import { useEffect } from 'react';
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSigma } from '@react-sigma/core';
import '@react-sigma/core/lib/react-sigma.min.css';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { buildGraph } from '@/lib/toGraphology';
import type { GNode, GEdge } from '@/lib/toGraph';

function LoadGraph({ nodes, edges, pins }: { nodes: GNode[]; edges: GEdge[]; pins: string[] }) {
  const loadGraph = useLoadGraph();
  useEffect(() => {
    const g = buildGraph(nodes, edges, pins);
    forceAtlas2.assign(g, { iterations: 100, settings: { gravity: 1, scalingRatio: 10 } });
    loadGraph(g);
  }, [nodes, edges, pins, loadGraph]);
  return null;
}

function Events({ onSelect }: { onSelect: (n: GNode | null) => void }) {
  const sigma = useSigma();
  const register = useRegisterEvents();
  useEffect(() => {
    register({
      clickNode: ({ node }) => onSelect(sigma.getGraph().getNodeAttributes(node) as GNode),
      clickStage: () => onSelect(null),
      // hover → tooltip: enterNode / leaveNode
    });
  }, [register, sigma, onSelect]);
  return null;
}

export function SigmaCanvas({ nodes, edges, pins, onSelect }: {
  nodes: GNode[]; edges: GEdge[]; pins: string[];
  onSelect: (n: GNode | null) => void;
}) {
  return (
    <SigmaContainer style={{ width: '100%', height: '100%' }}
      settings={{ renderEdgeLabels: false, defaultEdgeType: 'line' }}>
      <LoadGraph nodes={nodes} edges={edges} pins={pins} />
      <Events onSelect={onSelect} />
    </SigmaContainer>
  );
}
```

### 6.4 Layouts — the gap

Sigma has **no built-in layout menu**. You wire each one from a graphology
package:

| Legacy layout | graphology equivalent |
|---|---|
| COLA / cose-bilkent (force) | `graphology-layout-forceatlas2` ✓ |
| circle | `graphology-layout` → `circular` ✓ |
| random | `graphology-layout` → `random` ✓ |
| grid | hand-roll (assign x/y on a lattice) |
| concentric | hand-roll (rank by degree, place on rings) |
| dagre (hierarchical) | `graphology-dag` / `dagre` adapter, or hand-roll |

```ts
import circular from 'graphology-layout/circular';
import { random } from 'graphology-layout';
circular.assign(g);   // then sigma.refresh()
```

So you keep force/circle/random cheaply; **grid, concentric, dagre are custom
work.** This is the first real cost vs Cytoscape.

### 6.5 Hub / Sub-Graph / Neighborhood — reimplement on graphology

The legacy `InteractionOps` calls (`bfs`, `dijkstra`, `neighborhood`,
`connectedEdges`) are Cytoscape APIs — they **do not** exist on graphology. Rewrite
against graphology's API:

```ts
// lib/sigmaOps.ts
import type Graph from 'graphology';
import { bfsFromNode } from 'graphology-traversal';

// neighborhood — port of contextMenu 'selectNeighborhood'
export function neighborhood(g: Graph, node: string): string[] {
  return [node, ...g.neighbors(node)];
}

// connected subgraph via BFS — port of 'selectSubgraph' (:542)
export function connectedSubgraph(g: Graph, node: string): string[] {
  const out: string[] = [];
  bfsFromNode(g, node, (n) => { out.push(n); });
  return out;
}

// hubs by degree — port of getHubs (:125)
export function getHubs(g: Graph, minNeighbors: number): string[] {
  if (minNeighbors === Infinity) { // "most connected"
    let max = -1, best: string[] = [];
    g.forEachNode((n) => {
      const d = g.degree(n);
      if (d > max) { max = d; best = [n]; }
      else if (d === max) best.push(n);
    });
    return best;
  }
  const hubs: string[] = [];
  g.forEachNode((n) => { if (g.degree(n) >= minNeighbors) hubs.push(n); });
  return hubs;
}

// connected components ≥ N — port of getSubGraphs (:71)
import { connectedComponents } from 'graphology-components';
export function subGraphs(g: Graph, minSize: number): string[] {
  return connectedComponents(g).filter(c => c.length >= minSize).flat();
}
```

> `graphology-components.connectedComponents` replaces the hand-rolled
> `getUniqueRootNodes` + per-root BFS (`InteractionOps.js:21-123`) — cleaner than
> the original. That's a point in Sigma's favor for this one algorithm.

**Selection highlight:** Sigma has no native `:selected` state. You implement
selection by mutating node attributes (`color`, `highlighted: true`) or via a
`nodeReducer`/`edgeReducer` that recolors based on a selection Set:

```ts
sigma.setSetting('nodeReducer', (node, data) =>
  selected.has(node) ? { ...data, color: COLORS.selected, zIndex: 1 } : data);
```

### 6.6 Context menu, box-select, tooltip

None are built in:

- **Context menu:** render your own React menu on `rightClickNode` event.
- **Box / lasso select:** no native support — implement a drag-rectangle overlay
  and hit-test node screen coords (`sigma.graphToViewport`). This is the hardest
  missing piece.
- **Tooltip:** `enterNode`/`leaveNode` events → React tooltip.

### 6.7 PNG export

No `cy.png()` equivalent. Use `@sigma/export-image` or grab the WebGL canvases and
composite them:

```bash
npm i @sigma/export-image
```

```ts
import { downloadAsImage } from '@sigma/export-image';
downloadAsImage(sigma, { fileName: 'BVBRC_interaction', format: 'png' });
```

### 6.8 Effort estimate

| Piece | Effort |
|---|---|
| Canvas + styling | Low |
| Force/circle/random layouts | Low |
| **Grid/concentric/dagre layouts** | **Medium (custom)** |
| Hubs / components | Low (graphology has it) |
| Neighborhood/subgraph | Low (traversal pkg) |
| Selection highlight (reducers) | Medium |
| **Context menu** | Medium (custom) |
| **Box-select** | **High (custom hit-testing)** |
| Tooltip | Low |
| PNG export | Low (`@sigma/export-image`) |

**Overall: MEDIUM–HIGH.** Rendering is easy; the interaction/analysis UI is
rebuilt piece by piece.

---

## 7. Side-by-side decision matrix

| Dimension | react-cytoscapejs | Sigma.js + graphology |
|---|---|---|
| Port fidelity | **1:1**, copy stylesheet + ops | Rebuild interactions |
| Renderer | Canvas/SVG | **WebGL** |
| Practical node ceiling | ~2–3k smooth | **10k+ smooth** |
| PPI graph size (this app) | ✅ well within | ✅ (overkill) |
| 7 layouts | **all built-in** | 3 free, 3 custom |
| Hub/subgraph/neighborhood algos | **verbatim copy** | reimplement (graphology helps) |
| Context menu | extension exists | custom |
| Box multi-select | **built-in** | **custom (hard)** |
| PNG export | `cy.png()` | `@sigma/export-image` |
| New code volume | Low | Medium–High |
| Bundle size | larger (cytoscape + exts) | leaner core, WebGL |
| Maintenance | mature, stable | mature, modern, growing |

### Recommendation

- The PPI graph is **small** (≤5000 rows, capped in `InteractionMemoryStore.js:72`)
  and **feature-heavy** (7 layouts + hub/subgraph/neighborhood + box-select +
  export). That profile favors **react-cytoscapejs** — you keep every feature and
  the algorithms port verbatim.
- Choose **Sigma.js** only if you expect the graph to grow past a few thousand
  nodes (e.g. whole-genus interactomes, cross-taxon merges) and are willing to
  rebuild the interaction layer for WebGL performance.

Build both if you must compare, but budget accordingly: A is a weekend; B is a
sprint.

---

## 8. Build order (either path)

1. §2 data layer + `/api/ppi` proxy — verify a raw fetch returns rows.
2. §3 `toGraph` transform — unit-test node/edge counts against a known taxon.
3. §4 shell (toolbar/legend/detail panel stubs).
4. Renderer canvas (§5 or §6) — get nodes/edges on screen with color.
5. Layouts → selection → hub/subgraph → context menu → export.
6. Wire detail-panel actions (§4 nav table).
7. Pinned-feature highlight (pass `pins` from the feature you navigated in from).

### One check worth keeping

The node/edge derivation is the only non-trivial pure logic. Leave a test:

```ts
// lib/toGraph.test.ts
import { toGraph } from './toGraph';
const rows = [{ id: 'e1', interactor_a: 'A', interactor_b: 'B',
  domain_a: 'Bacteria', domain_b: 'Homo sapiens', evidence: 'experimental',
  /* …minimal fields… */ } as any];
const { nodes, edges } = toGraph(rows);
console.assert(nodes.length === 2, 'dedupes to 2 nodes');
console.assert(nodes.find(n => n.id === 'A')!.kind === 'microbial', 'Bacteria→microbial');
console.assert(nodes.find(n => n.id === 'B')!.kind === 'host', 'non-pathogen→host');
console.assert(edges[0].experimental === true, 'evidence→experimental flag');
```

---

## Appendix: legacy file → new module map

| Legacy | New |
|---|---|
| `store/InteractionMemoryStore.js` | `app/api/ppi/route.ts` + `lib/useInteractions.ts` |
| `InteractionOps.createInteractorCyEle` | `lib/toGraph.ts` |
| `InteractionOps.getHubs/getSubGraphs` | A: `lib/interactionOps.ts` (copy) · B: `lib/sigmaOps.ts` (rewrite) |
| `InteractionGraphContainer` stylesheet | A: `CytoCanvas` stylesheet · B: `buildGraph` attrs |
| `InteractionGraphContainer` legend | `GraphLegend.tsx` |
| `InteractionGraphContainer` actions | `DetailPanel.tsx` + nav table |
| `Taxonomy.js` query build | `lib/useInteractions.ts` `buildQuery` |
| `InteractionsContainer` (Table+Graph tabs) | `InteractionsGraph.tsx` + a TanStack table |
