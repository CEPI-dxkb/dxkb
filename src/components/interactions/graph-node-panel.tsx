"use client";

// A selected protein, drawn at the centre of its own small network: partners on a ring, lines
// coloured by evidence, a click on a partner moves there. Below it a filterable list holds the
// partners that do not fit on the ring (and carries each partner's interaction). Focus and the
// identifiers sit at the top, above the diagram, so a long partner list never pushes them away.

import { useState } from "react";
import { ChevronRight, Crosshair } from "lucide-react";

import { colors } from "@/lib/interactions/graph-theme";
import {
  nodeLabel,
  nodeProduct,
  partnersOf,
  plural,
  shortId,
  type Partner,
} from "@/lib/interactions/node-insight";
import type { GEdge, GNode } from "@/lib/interactions/types";

import {
  EvidenceSwatch,
  FocusAction,
  MaybeLink,
  featureLinkHref,
  genomeLinkHref,
} from "./graph-detail-parts";
import { GraphNodeDot } from "./graph-node-dot";

const ringCapacity = 10;
const width = 288;
const height = 244;
const centreX = width / 2;
const centreY = height / 2;
const ringX = 60;
const ringY = 78;
const listLimit = 40;

function clip(text: string, max = 11): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface GraphNodePanelProps {
  node: GNode;
  incidence: ReadonlyMap<string, readonly GEdge[]>;
  nodesById: ReadonlyMap<string, GNode>;
  onSelectEdge: (edge: GEdge) => void;
  /** Selects a partner (replacing the selection), which moves this panel to it. */
  onSelectNode: (node: GNode, additive: boolean) => void;
  /** Offers "Focus on this protein"; omitted, no button is drawn. */
  onFocusNode?: (node: GNode) => void;
}

export function GraphNodePanel({
  node,
  incidence,
  nodesById,
  onSelectEdge,
  onSelectNode,
  onFocusNode,
}: GraphNodePanelProps) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const partners = partnersOf(node, incidence, nodesById);
  const interactionCount = incidence.get(node.id)?.length ?? 0;
  const onRing = partners.slice(0, ringCapacity);
  const q = query.trim().toLowerCase();
  const filtered = partners.filter(
    (p) =>
      !q ||
      nodeLabel(p.node).toLowerCase().includes(q) ||
      nodeProduct(p.node).toLowerCase().includes(q),
  );
  const shown = showAll ? filtered : filtered.slice(0, listLimit);
  const product = nodeProduct(node);

  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-1 p-3 pb-0">
        <div className="flex items-center gap-2">
          <GraphNodeDot node={node} />
          <h2 className="min-w-0 flex-1 truncate text-lg leading-tight font-semibold">
            {nodeLabel(node)}
          </h2>
          <span className="shrink-0 rounded-sm border px-1 text-2xs text-muted-foreground uppercase">
            {node.kind}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {product || "No product annotation"}
        </p>
        {onFocusNode && (
          <div className="mt-1">
            <FocusAction node={node} onFocusNode={onFocusNode} />
          </div>
        )}
      </header>

      <details className="group mt-3 border-t">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs focus-visible:bg-accent/50 focus-visible:outline-none">
          <span className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
            Identifiers
          </span>
          <span className="min-w-0 flex-1 truncate text-right font-mono text-muted-foreground group-open:hidden">
            {node.refseqLocusTag || shortId(node.id)}
          </span>
          <ChevronRight
            aria-hidden
            className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          />
        </summary>
        <dl className="flex flex-col gap-2 px-3 pb-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Genome</dt>
            <dd className="wrap-break-word">
              <MaybeLink href={genomeLinkHref(node)}>
                {node.genome || node.genomeId || "—"}
              </MaybeLink>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Locus tag</dt>
            <dd className="font-mono">{node.refseqLocusTag || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">BRC ID</dt>
            <dd className="font-mono break-all">
              <MaybeLink href={featureLinkHref(node)}>
                {node.id}
              </MaybeLink>
            </dd>
          </div>
        </dl>
      </details>

      {partners.length > 0 && (
        <svg
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          className="mx-auto w-full max-w-sm text-2xs [&_text]:fill-foreground"
          role="group"
          aria-label={`${nodeLabel(node)} and ${plural(partners.length, "partner", "partners")}`}
        >
          {onRing.map((partner, index) => {
            const point = ringPoint(index, onRing.length);
            const active = hovered === partner.node.id;
            return (
              <line
                key={`edge-${partner.node.id}`}
                x1={centreX}
                y1={centreY}
                x2={point.x}
                y2={point.y}
                stroke={partner.verified ? colors.edgeExperimental : colors.dim}
                strokeWidth={active ? 2.5 : partner.verified ? 1.75 : 1}
                strokeOpacity={active ? 1 : partner.verified ? 0.85 : 0.45}
              />
            );
          })}
          {onRing.map((partner, index) => {
            const point = ringPoint(index, onRing.length);
            const active = hovered === partner.node.id;
            const anchor =
              Math.abs(point.x - centreX) < 12
                ? "middle"
                : point.x > centreX
                  ? "start"
                  : "end";
            const dx = anchor === "start" ? 10 : anchor === "end" ? -10 : 0;
            const dy = anchor === "middle" ? (point.y < centreY ? -11 : 17) : 3;
            return (
              <g
                key={partner.node.id}
                role="button"
                tabIndex={0}
                aria-label={`Select ${nodeLabel(partner.node)}`}
                className="cursor-pointer outline-none focus-visible:[&_circle]:stroke-foreground"
                onPointerEnter={() => {
                  setHovered(partner.node.id);
                }}
                onPointerLeave={() => {
                  setHovered(null);
                }}
                onFocus={() => {
                  setHovered(partner.node.id);
                }}
                onBlur={() => {
                  setHovered(null);
                }}
                onClick={() => {
                  onSelectNode(partner.node, false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectNode(partner.node, false);
                  }
                }}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={active ? 8 : 6}
                  fill={
                    partner.node.kind === "host"
                      ? colors.host
                      : colors.microbial
                  }
                  strokeWidth={2}
                  stroke="transparent"
                />
                <text
                  x={point.x + dx}
                  y={point.y + dy}
                  textAnchor={anchor}
                  fontWeight={active ? 700 : 400}
                >
                  {clip(nodeLabel(partner.node))}
                </text>
              </g>
            );
          })}
          <circle
            cx={centreX}
            cy={centreY}
            r={15}
            fill={colors.selected}
            stroke={colors.edgeSelected}
            strokeWidth={0}
          />
          {partners.length > onRing.length && (
            <text
              x={width - 6}
              y={height - 6}
              textAnchor="end"
              className="[&]:fill-muted-foreground"
            >
              +{partners.length - onRing.length} more below
            </text>
          )}
        </svg>
      )}

      <section className="flex flex-col gap-2 border-t p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">
            Interactions ({interactionCount})
          </h3>
          <span className="flex items-center gap-2 text-2xs text-muted-foreground">
            <EvidenceSwatch verified /> verified
            <EvidenceSwatch verified={false} /> predicted
          </span>
        </div>
        {partners.length > 8 && (
          <input
            type="search"
            value={query}
            placeholder={`Filter ${String(partners.length)} partners…`}
            aria-label="Filter partners"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            className="h-7 rounded-md border border-input/30 bg-input/30 px-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        )}
        <ul className="-mx-1 flex flex-col">
          {shown.map((partner) => (
            <PartnerRow
              key={partner.node.id}
              partner={partner}
              onOpenEdge={() => {
                onSelectEdge(partner.edges[0]);
              }}
              onOpenNode={() => {
                onSelectNode(partner.node, false);
              }}
            />
          ))}
        </ul>
        {filtered.length > shown.length && (
          <button
            type="button"
            onClick={() => {
              setShowAll(true);
            }}
            className="self-start rounded-sm text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Show all {filtered.length.toLocaleString()}
          </button>
        )}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {partners.length === 0
              ? "No interactions in the graph."
              : "No partners match."}
          </p>
        )}
      </section>
    </div>
  );
}

function ringPoint(index: number, count: number) {
  // Start at the top and go clockwise; an ellipse suits the panel's wide, short drawing box.
  const angle = -Math.PI / 2 + (index / Math.max(count, 1)) * Math.PI * 2;
  return {
    x: centreX + ringX * Math.cos(angle),
    y: centreY + ringY * Math.sin(angle),
  };
}

function PartnerRow({
  partner,
  onOpenEdge,
  onOpenNode,
}: {
  partner: Partner;
  onOpenEdge: () => void;
  onOpenNode: () => void;
}) {
  const method = partner.edges[0].detectionMethod;
  return (
    <li className="flex items-center gap-1 rounded-md hover:bg-accent/50">
      <button
        type="button"
        onClick={onOpenEdge}
        title={partner.edges
          .map((e) =>
            [e.interactionType, e.detectionMethod].filter(Boolean).join(" · "),
          )
          .join("\n")}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left text-sm focus-visible:bg-accent/50 focus-visible:outline-none"
      >
        <EvidenceSwatch verified={partner.verified} />
        <span className="min-w-0 flex-1 truncate">
          {nodeLabel(partner.node)}
        </span>
        <span className="max-w-28 truncate text-2xs text-muted-foreground">
          {method}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Select ${nodeLabel(partner.node)}`}
        onClick={onOpenNode}
        title={`Select ${nodeLabel(partner.node)}`}
        className="mr-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm border border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground focus-visible:border-border focus-visible:bg-background focus-visible:text-foreground"
      >
        <Crosshair className="size-3.5" />
      </button>
    </li>
  );
}
