"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { cn } from "@/lib/utils";

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

/**
 * How much wider than the core line the card-colored halo is, in screen
 * pixels. At 1x pixel density a sub-pixel core and halo blend into one pixel
 * near the fill's own grey, so layers draw a 1px core: with this 0.5 halo,
 * measured grey-on-grey borders reach ~2.2-2.7:1 at 1x (a 0.5 core gave
 * 1.27:1). A 1px halo swallows small countries (Belgium) in the world view.
 */
const haloExtraWidth = 0.5;

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
    <>
      <path
        d={pathD}
        fill={fill}
        stroke="var(--geo-border-halo)"
        strokeWidth={strokeWidth + haloExtraWidth}
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
      <path
        d={pathD}
        fill="none"
        stroke="var(--geo-border)"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    </>
  );
}
