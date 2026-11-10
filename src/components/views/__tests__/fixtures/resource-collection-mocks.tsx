import type { ReactNode } from "react";

import { createSearchActionBarFake } from "./search-action-bar-fake";

/**
 * Call these from inside a `vi.mock` factory, never module scope: factories are
 * hoisted above static imports.
 */

export function nextNavigationMock({
  push = vi.fn(),
  pathname = "/taxonomy/2955291",
  search = "tab=strains",
}: { push?: () => void; pathname?: string; search?: string } = {}) {
  return {
    useRouter: () => ({ push }),
    usePathname: () => pathname,
    useSearchParams: () => new URLSearchParams(search),
  };
}

export async function reactQueryMock() {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
}

export function authProviderMock(
  user: { username: string; realm: string } | null = null,
) {
  return { useAuth: () => ({ user, isAuthenticated: user !== null }) };
}

export function workspaceRepositoryContextMock() {
  return {
    useWorkspaceRepository: () => ({
      createIdGroup: vi.fn(),
      appendToIdGroup: vi.fn(),
    }),
  };
}

export function collectionCopyDialogMock() {
  return {
    CollectionCopyDialog: ({ open }: { open: boolean }) =>
      open ? <div data-testid="copy-dialog" /> : null,
  };
}

export function selectionServiceChooserMock() {
  return {
    SelectionServiceChooser: ({
      open,
      kind = "genome",
      ids = [],
    }: {
      open: boolean;
      kind?: "genome" | "feature";
      ids?: readonly string[];
    }) =>
      open ? (
        <div data-testid="selection-services" data-kind={kind}>
          <span>Selectable services</span>
          <span data-testid="selection-service-ids">{ids.join(",")}</span>
        </div>
      ) : null,
  };
}

export function selectionToGroupDialogMock() {
  return {
    SelectionToGroupDialog: ({
      open,
      ids = [],
    }: {
      open: boolean;
      ids?: readonly string[];
    }) =>
      open ? <div data-testid="selection-group">{ids.join(",")}</div> : null,
  };
}

export function collectionDownloadMock(download = vi.fn()) {
  return {
    useCollectionDownload: () => ({ download, pending: null }),
  };
}

export function resourceExportMock(downloadResourceExport = vi.fn()) {
  return { downloadResourceExport, serializeResourceRows: vi.fn() };
}

export function resourceFilterBarMock() {
  return {
    ResourceFilterBar: (props: Record<string, unknown>) => (
      <div
        data-testid="filter-bar"
        data-definitions={JSON.stringify(props.definitions)}
        data-keyword={typeof props.keyword === "string" ? props.keyword : ""}
      />
    ),
  };
}

export function searchActionBarMock(
  onRender: (props: Record<string, unknown>) => void,
) {
  return { SearchActionBar: createSearchActionBarFake(onRender) };
}

export function infoPanelMock() {
  return {
    InfoPanel: ({
      selectedRow,
    }: {
      selectedRow: Record<string, unknown> | null;
    }) => (
      <div data-testid="detail">
        {selectedRow ? String(selectedRow.genome_name) : null}
      </div>
    ),
  };
}

export function taxonomyServiceChooserMock() {
  return {
    TaxonomyServiceChooser: ({
      open,
      taxonIds = [],
    }: {
      open: boolean;
      taxonIds?: readonly string[];
    }) =>
      open ? (
        <div data-testid="taxonomy-services">{taxonIds.join(",")}</div>
      ) : null,
  };
}

export function flatResourceWorkspaceMock() {
  return {
    ResourceWorkspace: ({
      children,
      toolbar,
      actionBar,
      sidePanel,
      hasActionRail = true,
      hasSidePanel = true,
    }: {
      children: ReactNode;
      toolbar?: ReactNode;
      actionBar: ReactNode;
      sidePanel: ReactNode;
      hasActionRail?: boolean;
      hasSidePanel?: boolean;
    }) => (
      <div>
        {hasActionRail && actionBar}
        {toolbar}
        {children}
        {hasSidePanel && sidePanel}
      </div>
    ),
  };
}

export function dataTableMock(
  onRender: (props: Record<string, unknown>) => void = () => undefined,
) {
  return {
    DataTable: (props: Record<string, unknown>) => {
      onRender(props);
      return <div data-testid="data-table" />;
    },
  };
}
