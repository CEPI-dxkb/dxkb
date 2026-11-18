import type { GEdge, GNode, GraphSelection } from "@/lib/interactions/types";

// Hub and sub-graph presets can select thousands of nodes; render a bounded number of cards per
// kind and say how many are left out.
export const detailCardLimit = 25;

interface GraphDetailPanelProps {
  selection: GraphSelection;
  incidentEdgesByNode: ReadonlyMap<string, readonly GEdge[]>;
  nodesById: Map<string, GNode>;
  onSelectEdge: (edge: GEdge) => void;
}

function endpointLabel(nodesById: Map<string, GNode>, id: string): string {
  const n = nodesById.get(id);
  return n?.gene || id;
}

function NodeFields({ node }: { node: GNode }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
      <dt className="font-medium text-foreground">BRC ID</dt>
      <dd className="break-all text-muted-foreground">{node.id}</dd>
      <dt className="font-medium text-foreground">Genome</dt>
      <dd className="break-all text-muted-foreground">{node.genome || "—"}</dd>
      <dt className="font-medium text-foreground">Locus tag</dt>
      <dd className="break-all text-muted-foreground">{node.refseqLocusTag || "—"}</dd>
      <dt className="font-medium text-foreground">Gene</dt>
      <dd className="break-all text-muted-foreground">{node.gene || "—"}</dd>
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
      <dd className="break-all text-muted-foreground">{endpointLabel(nodesById, edge.source)}</dd>
      <dt className="font-medium text-foreground">To</dt>
      <dd className="break-all text-muted-foreground">{endpointLabel(nodesById, edge.target)}</dd>
      <dt className="font-medium text-foreground">Interaction type</dt>
      <dd className="break-all text-muted-foreground">{edge.interactionType || "—"}</dd>
      <dt className="font-medium text-foreground">Detection method</dt>
      <dd className="break-all text-muted-foreground">{edge.detectionMethod || "—"}</dd>
      <dt className="font-medium text-foreground">Evidence</dt>
      <dd className="break-all text-muted-foreground">{edge.evidence || "—"}</dd>
    </dl>
  );
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

export function GraphDetailPanel({ selection, incidentEdgesByNode, nodesById, onSelectEdge }: GraphDetailPanelProps) {
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
                <p className="font-medium break-all text-foreground">{node.gene || node.id}</p>
                <NodeFields node={node} />
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

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3 text-sm">
      {selection.nodes.map((node) => {
        const incidentEdges = incidentEdgesByNode.get(node.id) ?? [];
        return (
          <div key={node.id} className="flex flex-col gap-2">
            <NodeFields node={node} />
            {incidentEdges.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">
                  Interactions ({incidentEdges.length})
                </p>
                <ul className="flex flex-col gap-0.5">
                  {incidentEdges.map((edge) => {
                    const otherId = edge.source === node.id ? edge.target : edge.source;
                    return (
                      <li key={edge.id}>
                        <button
                          type="button"
                          onClick={() => { onSelectEdge(edge); }}
                          className="w-full rounded px-2 py-1 text-left break-all text-muted-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                        >
                          {endpointLabel(nodesById, otherId)}
                          {edge.interactionType ? ` · ${edge.interactionType}` : ""}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
      {selection.edges.map((edge) => (
        <div key={edge.id} className="flex flex-col gap-2">
          <p className="font-medium text-foreground">Interaction</p>
          <EdgeFields edge={edge} nodesById={nodesById} />
        </div>
      ))}
    </div>
  );
}
