// The panel is exported only through its lazy wrapper: a static re-export
// would put it, and its data client, in every chunk that imports this module.
// The view is never re-exported (it would pull JBrowse into the eager bundle).
export { LazyGenomeBrowserPanel as GenomeBrowserPanel } from "./lazy-genome-browser-panel";
export type { GenomeBrowserPanelProps } from "./genome-browser-panel";
