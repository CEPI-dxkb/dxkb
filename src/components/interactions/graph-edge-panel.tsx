"use client";

// A selected interaction in the same style as the protein panel: the two proteins as a pair joined
// by a line coloured by evidence, then the proteins as selectable rows, the evidence facts, and any
// other records between the same two proteins. Identifiers fold away under the header.

import { useState } from "react";
import { ChevronRight, Crosshair } from "lucide-react";

import { colors } from "@/lib/interactions/graph-theme";
import {
  nodeLabel,
  nodeProduct,
  plural,
  shortId,
  siblingEdges,
} from "@/lib/interactions/node-insight";
import type { GEdge, GNode } from "@/lib/interactions/types";

import {
  EvidenceSwatch,
  MaybeLink,
  featureLinkHref,
  genomeLinkHref,
} from "./graph-detail-parts";
import { GraphNodeDot } from "./graph-node-dot";

const width = 288;
const height = 112;
const leftX = 60;
const rightX = width - 60;
const nodeY = 44;

function clip(text: string, max = 14): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface GraphEdgePanelProps {
  edge: GEdge;
  incidence: ReadonlyMap<string, readonly GEdge[]>;
  nodesById: ReadonlyMap<string, GNode>;
  /** Selects another record between the same two proteins. */
  onSelectEdge: (edge: GEdge) => void;
  /** Selects one end (replacing the selection), which swaps this panel for the protein's. */
  onSelectNode: (node: GNode, additive: boolean) => void;
}

export function GraphEdgePanel({
  edge,
  incidence,
  nodesById,
  onSelectEdge,
  onSelectNode,
}: GraphEdgePanelProps) {
  const [hovered, setHovered] = useState<"from" | "to" | null>(null);
  const from = nodesById.get(edge.source);
  const to = nodesById.get(edge.target);
  const verified = edge.experimental;
  const siblings = siblingEdges(edge, incidence);
  const ends = [
    { key: "from" as const, caption: "From", node: from, id: edge.source },
    { key: "to" as const, caption: "To", node: to, id: edge.target },
  ];

  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-1 p-3 pb-0">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-lg leading-tight font-semibold">
            Interaction
          </h2>
          <span className="flex shrink-0 items-center gap-1.5 rounded-sm border px-1 text-2xs text-muted-foreground uppercase">
            <EvidenceSwatch verified={verified} />
            {verified ? "verified" : "predicted"}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          Between {from ? nodeLabel(from) : shortId(edge.source)} and{" "}
          {to ? nodeLabel(to) : shortId(edge.target)}
        </p>
      </header>

      <details className="group mt-3 border-t">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs focus-visible:bg-accent/50 focus-visible:outline-none">
          <span className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
            Identifiers
          </span>
          <span className="min-w-0 flex-1 truncate text-right font-mono text-muted-foreground group-open:hidden">
            {ends
              .map(({ node, id }) =>
                node ? node.refseqLocusTag || shortId(node.id) : shortId(id),
              )
              .join(" · ")}
          </span>
          <ChevronRight
            aria-hidden
            className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          />
        </summary>
        <div className="flex flex-col gap-3 px-3 pb-3 text-xs">
          {ends.map(({ key, caption, node, id }) => (
            <dl key={key} className="flex flex-col gap-2">
              <dt className="flex items-center gap-1.5 font-medium">
                {node && <GraphNodeDot node={node} />}
                <span className="text-2xs tracking-wider text-muted-foreground uppercase">
                  {caption}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {node ? nodeLabel(node) : shortId(id)}
                </span>
              </dt>
              <dd className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1">
                <span className="text-muted-foreground">Genome</span>
                <span className="wrap-break-word">
                  {node ? (
                    <MaybeLink href={genomeLinkHref(node)}>
                      {node.genome || node.genomeId || "—"}
                    </MaybeLink>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-muted-foreground">Locus tag</span>
                <span className="font-mono">{node?.refseqLocusTag || "—"}</span>
                <span className="text-muted-foreground">BRC ID</span>
                <span className="font-mono break-all">
                  <MaybeLink href={node ? featureLinkHref(node) : null}>
                    {id}
                  </MaybeLink>
                </span>
              </dd>
            </dl>
          ))}
        </div>
      </details>

      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="mx-auto w-full max-w-sm text-2xs [&_text]:fill-foreground"
        role="img"
        aria-label={`${from ? nodeLabel(from) : shortId(edge.source)} and ${to ? nodeLabel(to) : shortId(edge.target)}, joined by a ${verified ? "verified" : "predicted"} interaction`}
      >
        <line
          x1={leftX}
          y1={nodeY}
          x2={rightX}
          y2={nodeY}
          stroke={verified ? colors.edgeExperimental : colors.dim}
          strokeWidth={verified ? 3 : 1.75}
          strokeOpacity={verified ? 0.9 : 0.6}
          strokeDasharray={verified ? undefined : "5 4"}
        />
        {ends.map(({ key, node, id }) => {
          const x = key === "from" ? leftX : rightX;
          const active = hovered === key;
          return (
            <g key={key}>
              <circle
                cx={x}
                cy={nodeY}
                r={active ? 15 : 13}
                fill={node?.kind === "host" ? colors.host : colors.microbial}
                stroke={colors.edgeSelected}
                strokeWidth={active ? 3 : 2}
              />
              <text
                x={x}
                y={nodeY + 32}
                textAnchor="middle"
                fontWeight={active ? 700 : 500}
              >
                {clip(node ? nodeLabel(node) : shortId(id))}
              </text>
              <text
                x={x}
                y={nodeY + 45}
                textAnchor="middle"
                className="[&]:fill-muted-foreground"
              >
                {key === "from" ? "from" : "to"}
              </text>
            </g>
          );
        })}
      </svg>

      <section className="flex flex-col gap-2 border-t p-3">
        <h3 className="text-sm font-semibold">Proteins</h3>
        <ul className="-mx-1 flex flex-col">
          {ends.map(({ key, caption, node, id }) => (
            <li
              key={key}
              className="flex items-center gap-1 rounded-md hover:bg-accent/50"
              onPointerEnter={() => {
                setHovered(key);
              }}
              onPointerLeave={() => {
                setHovered(null);
              }}
            >
              <button
                type="button"
                disabled={!node}
                onClick={() => {
                  if (node) onSelectNode(node, false);
                }}
                onFocus={() => {
                  setHovered(key);
                }}
                onBlur={() => {
                  setHovered(null);
                }}
                title={node ? `Select ${nodeLabel(node)}` : undefined}
                className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-1.5 text-left focus-visible:bg-accent/50 focus-visible:outline-none"
              >
                {node ? (
                  <GraphNodeDot node={node} className="mt-1.5" />
                ) : (
                  <span className="mt-1.5 size-2.5 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-2xs tracking-wider text-muted-foreground uppercase">
                      {caption}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {node ? nodeLabel(node) : shortId(id)}
                    </span>
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {(node && nodeProduct(node)) || "No product annotation"}
                  </span>
                </span>
              </button>
              {node && (
                <button
                  type="button"
                  aria-label={`Select ${nodeLabel(node)}`}
                  title={`Select ${nodeLabel(node)}`}
                  onClick={() => {
                    onSelectNode(node, false);
                  }}
                  onFocus={() => {
                    setHovered(key);
                  }}
                  onBlur={() => {
                    setHovered(null);
                  }}
                  className="mr-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm border border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground focus-visible:border-border focus-visible:bg-background focus-visible:text-foreground"
                >
                  <Crosshair className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2 border-t p-3">
        <h3 className="text-sm font-semibold">Evidence</h3>
        <dl className="flex flex-col gap-2 text-xs">
          <div>
            <dt className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
              Interaction type
            </dt>
            <dd className="mt-0.5 text-sm wrap-break-word">
              {edge.interactionType || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
              Detection method
            </dt>
            <dd className="mt-0.5 text-sm wrap-break-word">
              {edge.detectionMethod || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
              Evidence
            </dt>
            <dd className="mt-0.5 text-sm wrap-break-word">
              {edge.evidence || "—"}
            </dd>
          </div>
        </dl>
      </section>

      {siblings.length > 0 && (
        <section className="flex flex-col gap-2 border-t p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Also between these two</h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {plural(siblings.length, "record", "records")}
            </span>
          </div>
          <ul className="-mx-1 flex flex-col">
            {siblings.map((other) => (
              <li key={other.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectEdge(other);
                  }}
                  className="flex w-full items-center gap-2 rounded-md p-1 text-left text-sm hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                >
                  <EvidenceSwatch verified={other.experimental} />
                  <span className="min-w-0 flex-1 truncate">
                    {other.interactionType || "Interaction"}
                  </span>
                  <span className="max-w-28 truncate text-2xs text-muted-foreground">
                    {other.detectionMethod}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
