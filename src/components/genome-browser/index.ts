// The panel is exported only through its lazy wrapper, and the view is never
// re-exported: either would pull JBrowse into the eager bundle.
export { LazyGenomeBrowserPanel as GenomeBrowserPanel } from "./lazy-genome-browser-panel";
export type { GenomeBrowserPanelProps } from "./genome-browser-panel";
