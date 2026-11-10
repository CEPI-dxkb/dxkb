import { createContext } from "react";
import type { FeatureRef } from "@/lib/compare-region/families";

export const HoverContext = createContext<FeatureRef | undefined>(undefined);

export const PinContext = createContext<FeatureRef | null>(null);

export const RowHoverContext = createContext<number | null>(null);
