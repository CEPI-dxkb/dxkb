import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { MetadataLink } from "@/components/detail-panel/metadata-link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isGenomeId } from "@/lib/genome-view/schema";
import type { GEdge, GNode, GraphSelection } from "@/lib/interactions/types";
import { featureHref, genomeHref } from "@/lib/views/hrefs";

// Hub and sub-graph presets can select thousands of nodes; render a bounded number of cards per
// kind and say how many are left out.
const detailCardLimit = 25;

interface GraphDetailPanelProps {
  selection: GraphSelection;
  incidentEdgesByNode: ReadonlyMap<string, readonly GEdge[]>;
  nodesById: Map<string, GNode>;
  onSelectEdge: (edge: GEdge) => void;
  /** Offers "Focus on this protein" for a single selected node; omitted, no button is drawn. */
  onFocusNode?: (node: GNode) => void;
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

function plural(count: number, singular: string, pluralForm: string): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

export function GraphDetailPanel({ selection, incidentEdgesByNode, nodesById, onSelectEdge, onFocusNode }: GraphDetailPanelProps) {
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

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3 text-sm">
      {selection.nodes.map((node) => {
        const incidentEdges = incidentEdgesByNode.get(node.id) ?? [];
        return (
          <div key={node.id} className="flex flex-col gap-2">
            <NodeFields node={node} />
            {onFocusNode && (
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    onFocusNode(node);
                  }}
                >
                  Focus on this protein
                </Button>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost-accent"
                        size="icon-sm"
                        aria-label="About focusing"
                      />
                    }
                  >
                    <Info />
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="start">
                    <PopoverHeader>
                      <PopoverTitle>Focusing on a protein</PopoverTitle>
                      <PopoverDescription>
                        Shows only this protein&apos;s interactions; remove the Protein filter in the Filters menu to undo.
                      </PopoverDescription>
                    </PopoverHeader>
                  </PopoverContent>
                </Popover>
              </div>
            )}
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
