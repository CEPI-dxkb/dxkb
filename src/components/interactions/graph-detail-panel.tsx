import { plural } from "@/lib/interactions/node-insight";
import type { GEdge, GNode, GraphSelection } from "@/lib/interactions/types";

import { GraphEdgePanel } from "./graph-edge-panel";
import {
  MaybeLink,
  featureLinkHref,
  genomeLinkHref,
} from "./graph-detail-parts";
import { GraphNodePanel } from "./graph-node-panel";

// Hub and sub-graph presets can select thousands of nodes; render a bounded number of cards per
// kind and say how many are left out.
const detailCardLimit = 25;

interface GraphDetailPanelProps {
  selection: GraphSelection;
  incidentEdgesByNode: ReadonlyMap<string, readonly GEdge[]>;
  nodesById: Map<string, GNode>;
  onSelectEdge: (edge: GEdge) => void;
  /** Moves the selection to one protein (a partner, or one end of an interaction). */
  onSelectNode: (node: GNode, additive: boolean) => void;
  /** Offers "Focus on this protein" for a single selected node; omitted, no button is drawn. */
  onFocusNode?: (node: GNode) => void;
}

function endpointLabel(nodesById: Map<string, GNode>, id: string): string {
  const n = nodesById.get(id);
  return n?.gene || id;
}

// `omit` drops the row a card heading already shows (the gene, or the id when there is no gene).
function NodeFields({ node, omit }: { node: GNode; omit?: "gene" | "id" }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
      {omit !== "id" && (
        <>
          <dt className="font-medium text-foreground">BRC ID</dt>
          <dd className="break-all text-muted-foreground">
            <MaybeLink href={featureLinkHref(node)}>{node.id}</MaybeLink>
          </dd>
        </>
      )}
      <dt className="font-medium text-foreground">Genome</dt>
      <dd className="break-all text-muted-foreground">
        {node.genome || node.genomeId ? (
          <MaybeLink href={genomeLinkHref(node)}>
            {node.genome || node.genomeId}
          </MaybeLink>
        ) : (
          "—"
        )}
      </dd>
      <dt className="font-medium text-foreground">Locus tag</dt>
      <dd className="break-all text-muted-foreground">{node.refseqLocusTag || "—"}</dd>
      {omit !== "gene" && (
        <>
          <dt className="font-medium text-foreground">Gene</dt>
          <dd className="break-all text-muted-foreground">
            {node.gene ? (
              <MaybeLink href={featureLinkHref(node)}>{node.gene}</MaybeLink>
            ) : (
              "—"
            )}
          </dd>
        </>
      )}
      <dt className="font-medium text-foreground">Product</dt>
      <dd className="break-all text-muted-foreground">{node.interactorDesc || "—"}</dd>
    </dl>
  );
}

function EdgeFields({
  edge,
  nodesById,
}: {
  edge: GEdge;
  nodesById: Map<string, GNode>;
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
      <dt className="font-medium text-foreground">From</dt>
      <dd className="break-all text-muted-foreground">
        <MaybeLink href={featureLinkHref(nodesById.get(edge.source))}>
          {endpointLabel(nodesById, edge.source)}
        </MaybeLink>
      </dd>
      <dt className="font-medium text-foreground">To</dt>
      <dd className="break-all text-muted-foreground">
        <MaybeLink href={featureLinkHref(nodesById.get(edge.target))}>
          {endpointLabel(nodesById, edge.target)}
        </MaybeLink>
      </dd>
      <dt className="font-medium text-foreground">Interaction type</dt>
      <dd className="break-all text-muted-foreground">{edge.interactionType || "—"}</dd>
      <dt className="font-medium text-foreground">Detection method</dt>
      <dd className="break-all text-muted-foreground">{edge.detectionMethod || "—"}</dd>
      <dt className="font-medium text-foreground">Evidence</dt>
      <dd className="break-all text-muted-foreground">{edge.evidence || "—"}</dd>
    </dl>
  );
}

export function GraphDetailPanel({
  selection,
  incidentEdgesByNode,
  nodesById,
  onSelectEdge,
  onSelectNode,
  onFocusNode,
}: GraphDetailPanelProps) {
  if (selection.nodes.length === 0 && selection.edges.length === 0) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        Select a node or edge to see details.
      </p>
    );
  }

  const selectedCount = selection.nodes.length + selection.edges.length;
  if (selectedCount > 1) {
    const shownNodes = selection.nodes.slice(0, detailCardLimit);
    const shownEdges = selection.edges.slice(0, detailCardLimit);
    const hiddenNodes = selection.nodes.length - shownNodes.length;
    const hiddenEdges = selection.edges.length - shownEdges.length;
    return (
      <div className="flex flex-col gap-3 p-3 text-sm">
        <div>
          <p className="font-medium text-foreground">Multiple selection</p>
          <p className="mt-1 text-muted-foreground">
            {plural(selection.nodes.length, "protein", "proteins")} and{" "}
            {plural(selection.edges.length, "interaction", "interactions")} selected.
          </p>
        </div>
        {shownNodes.length > 0 && (
          <ul className="flex flex-col gap-3">
            {shownNodes.map((node) => (
              <li key={`node:${node.id}`} className="flex flex-col gap-2 border-t pt-3">
                <p className="font-medium break-all text-foreground">
                  <MaybeLink href={featureLinkHref(node)}>{node.gene || node.id}</MaybeLink>
                </p>
                <NodeFields node={node} omit={node.gene ? "gene" : "id"} />
                <p className="text-muted-foreground">
                  Interactions: {incidentEdgesByNode.get(node.id)?.length ?? 0}
                </p>
              </li>
            ))}
          </ul>
        )}
        {hiddenNodes > 0 && (
          <p className="text-muted-foreground">
            …and {hiddenNodes} more {hiddenNodes === 1 ? "protein" : "proteins"} not shown.
          </p>
        )}
        {shownEdges.length > 0 && (
          <ul className="flex flex-col gap-3">
            {shownEdges.map((edge) => (
              <li key={`edge:${edge.id}`} className="flex flex-col gap-2 border-t pt-3">
                <p className="font-medium text-foreground">Interaction</p>
                <EdgeFields edge={edge} nodesById={nodesById} />
              </li>
            ))}
          </ul>
        )}
        {hiddenEdges > 0 && (
          <p className="text-muted-foreground">
            …and {hiddenEdges} more {hiddenEdges === 1 ? "interaction" : "interactions"} not shown.
          </p>
        )}
      </div>
    );
  }

  // One item: the protein panel or the interaction panel. Keyed so a new selection starts with a
  // closed Identifiers row and an empty partner filter.
  if (selection.nodes.length === 1) {
    const node = selection.nodes[0];
    return (
      <GraphNodePanel
        key={node.id}
        node={node}
        incidence={incidentEdgesByNode}
        nodesById={nodesById}
        onSelectEdge={onSelectEdge}
        onSelectNode={onSelectNode}
        onFocusNode={onFocusNode}
      />
    );
  }
  const edge = selection.edges[0];
  return (
    <GraphEdgePanel
      key={edge.id}
      edge={edge}
      incidence={incidentEdgesByNode}
      nodesById={nodesById}
      onSelectEdge={onSelectEdge}
      onSelectNode={onSelectNode}
    />
  );
}
