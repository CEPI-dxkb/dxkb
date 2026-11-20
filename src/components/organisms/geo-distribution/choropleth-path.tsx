"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { cn } from "@/lib/utils";

import { geoBorderFor } from "./color-scale";
import type { GeoMapView } from "./types";

export interface HoverPayload {
  view: GeoMapView;
  name: string;
  count: number;
  genera: Record<string, number>;
  hosts: Record<string, number>;
}

export type HoverEnter = (
  payload: HoverPayload,
  event: ReactPointerEvent<SVGPathElement>,
) => void;
export type HoverLeave = () => void;

interface ChoroplethPathProps {
  pathD: string;
  fill: string;
  /** The visible border line in screen pixels; it does not scale with zoom. */
  strokeWidth: number;
  cursor?: "pointer" | "default";
  isDraggingRef: RefObject<boolean>;
  payload: HoverPayload;
  onHoverEnter: HoverEnter;
  onHoverLeave: HoverLeave;
  onClick?: () => void;
}

export function ChoroplethPath({
  pathD,
  fill,
  strokeWidth,
  cursor,
  isDraggingRef,
  payload,
  onHoverEnter,
  onHoverLeave,
  onClick,
}: ChoroplethPathProps) {
  return (
    <path
      d={pathD}
      fill={fill}
      stroke={geoBorderFor(fill)}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      className={cn(
        cursor === "pointer" && "cursor-pointer",
        cursor === "default" && "cursor-default",
      )}
      onPointerMove={(event) => {
        if (isDraggingRef.current) return;
        onHoverEnter(payload, event);
      }}
      onPointerLeave={onHoverLeave}
      onClick={onClick}
    />
  );
}
