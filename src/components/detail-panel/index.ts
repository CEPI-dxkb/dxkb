import { DetailPanel as DetailPanelRoot } from "./detail-panel";
import { DetailHeader } from "./detail-header";
import { DetailKeyValueTable } from "./detail-key-value";
import { DetailCollapsibleSection } from "./detail-collapsible";
import { DetailEmptyState } from "./detail-empty-state";

export type { DetailField } from "./detail-key-value";

export const DetailPanel = Object.assign(DetailPanelRoot, {
  Header: DetailHeader,
  KeyValueTable: DetailKeyValueTable,
  CollapsibleSection: DetailCollapsibleSection,
  EmptyState: DetailEmptyState,
});
