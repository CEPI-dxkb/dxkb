// The panel is exported only through its lazy wrapper: a static re-export
// would put it, its chart and visx in every chunk that imports this module.
export { LazyCompareRegionPanel as CompareRegionPanel } from "./lazy-compare-region-panel";
export type { CompareRegionPanelProps } from "./compare-region-panel";
