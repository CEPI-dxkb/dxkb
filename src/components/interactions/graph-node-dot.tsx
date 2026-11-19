import type { CSSProperties } from "react";

import { colors } from "@/lib/interactions/graph-theme";
import type { GNode } from "@/lib/interactions/types";

/** The dot a protein wears on the canvas, in the legend and here: kind colour, amber when selected. */
export function GraphNodeDot({
  node,
  selected = false,
  className = "",
}: {
  node: GNode;
  selected?: boolean;
  className?: string;
}) {
  const color = selected
    ? colors.selected
    : node.kind === "host"
      ? colors.host
      : colors.microbial;
  return (
    <span
      aria-hidden
      data-slot="graph-node-dot"
      className={`size-2.5 shrink-0 rounded-full bg-(--dot-color) ${className}`}
      style={{ "--dot-color": color } as CSSProperties}
    />
  );
}
