import type { ReactNode } from "react";

import { MetadataLink } from "@/components/detail-panel/metadata-link";
import { isGenomeId } from "@/lib/genome-view/schema";
import type { GEdge, GNode, GraphSelection } from "@/lib/interactions/types";
import { featureHref, genomeHref } from "@/lib/views/hrefs";

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

function featureLinkHref(node: GNode | undefined): string | null {
  if (!node?.featureId || node.kind === "host") return null;
  return featureHref(node.featureId);
}

function genomeLinkHref(node: GNode | undefined): string | null {
  if (!node?.genomeId || node.kind === "host" || !isGenomeId(node.genomeId)) {
    return null;
  }
  return genomeHref(node.genomeId);
}

function MaybeLink({ href, children }: { href: string | null; children: ReactNode }) {
  return href ? <MetadataLink href={href}>{children}</MetadataLink> : children;
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
            <dd className="break-all text-muted-foreground">
              <MaybeLink href={featureLinkHref(node)}>{node.id}</MaybeLink>
            </dd>
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
            <dt className="font-medium text-foreground">Gene</dt>
            <dd className="break-all text-muted-foreground">
              {node.gene ? (
                <MaybeLink href={featureLinkHref(node)}>{node.gene}</MaybeLink>
              ) : (
                "—"
              )}
            </dd>
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
        </div>
      ))}
    </div>
  );
}
