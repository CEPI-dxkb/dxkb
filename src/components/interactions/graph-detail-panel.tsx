import type { GEdge, GNode, GraphSelection } from "@/lib/interactions/types";

interface GraphDetailPanelProps {
  selection: GraphSelection;
  incidentEdges: GEdge[];
  nodesById: Map<string, GNode>;
  onSelectEdge: (edge: GEdge) => void;
}

function endpointLabel(nodesById: Map<string, GNode>, id: string): string {
  const n = nodesById.get(id);
  return n?.gene || id;
}

export function GraphDetailPanel({ selection, incidentEdges, nodesById, onSelectEdge }: GraphDetailPanelProps) {
  if (selection.nodes.length === 0 && selection.edges.length === 0) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        Select a node or edge to see details.
      </p>
    );
  }

  const selectedCount = selection.nodes.length + selection.edges.length;
  if (selectedCount > 1) {
    return (
      <div className="p-3 text-sm">
        <p className="font-medium text-foreground">Bulk selection</p>
        <p className="mt-1 text-muted-foreground">
          {selection.nodes.length} proteins and {selection.edges.length} interactions selected.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3 text-sm">
      {selection.nodes.map((node) => (
        <div key={node.id} className="flex flex-col gap-2">
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
      ))}
      {selection.edges.map((edge) => (
        <div key={edge.id} className="flex flex-col gap-2">
          <p className="font-medium text-foreground">Interaction</p>
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
        </div>
      ))}
    </div>
  );
}
