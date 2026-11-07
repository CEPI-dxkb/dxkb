import { createContext } from "react";
import type { FeatureRef } from "@/lib/compare-region/families";

/** The gene under the pointer; undefined while the tooltip is closed. */
export const HoverContext = createContext<FeatureRef | undefined>(undefined);

/** The pinned gene, or null. */
export const PinContext = createContext<FeatureRef | null>(null);

/** Compact only: the row under the pointer, anywhere across the label column and the track. */
export const RowHoverContext = createContext<number | null>(null);
