import type { ReactNode } from "react";

import { createSearchActionBarFake } from "./search-action-bar-fake";

/**
 * The `vi.mock` module shapes every `resource-collection*.test.tsx` suite installs.
 *
 * `ResourceCollection` pulls in routing, TanStack Query, auth, the workspace
 * repository, three dialogs, the filter bar, the detail panel, the action bar, the
 * workspace shell and the data table, so each suite needs the same dozen or so
 * stubs before it can render anything. They were copied per file — about 160 lines
 * apiece — and the copies had already started to differ for no stated reason (one
 * suite's `SelectionServiceChooser` reported its `kind`, another returned `null`).
 *
 * Each export returns the object a `vi.mock` factory must return, so a suite keeps
 * its own `vi.mock` calls — the behaviour-focused suites stay separate files, and a
 * suite that needs a different stub (the real `ResourceWorkspace`, a filter bar with
 * keyword buttons, a data table that renders row links) simply does not call the
 * shared one.
 *
 * **Call these from inside the factory, never from module scope.** `vi.mock`
 * factories are hoisted above the file's own static imports, so a statically
 * imported helper referenced in one throws "Cannot access ... before
 * initialization". `vi.mock(path, async () => (await import("./fixtures/…")).someMock())`
 * defers the resolution to when the factory actually runs.
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

/**
 * Only `useQueryClient` is replaced; everything else in the module stays real, so a
 * consumer that reaches for a query hook still behaves. `vi.importActual` rather than
 * the factory's `importOriginal`, so the caller stays a one-liner.
 */
export async function reactQueryMock() {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
}

/** Signed out by default; pass a user for the signed-in GROUP and chooser paths. */
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

/**
 * Surfaces everything a suite has needed to assert: that it opened, the ID kind that
 * picked its service set, whether it has anything to offer, and the resolved IDs. The
 * label and the IDs are separate elements so `getByText("Selectable services")` still
 * matches a whole element.
 */
export function selectionServiceChooserMock() {
  return {
    SelectionServiceChooser: ({
      open,
      kind = "genome",
      hasSelectableServices = true,
      ids = [],
    }: {
      open: boolean;
      kind?: "genome" | "feature";
      hasSelectableServices?: boolean;
      ids?: readonly string[];
    }) =>
      open ? (
        <div data-testid="selection-services" data-kind={kind}>
          <span>
            {hasSelectableServices
              ? "Selectable services"
              : "No selectable services"}
          </span>
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

export function resourceExportMock(downloadResourceExport = vi.fn()) {
  return { downloadResourceExport, serializeResourceRows: vi.fn() };
}

/** Reports the filter definitions and keyword it was given; drives nothing. */
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

/**
 * The shared action-bar fake, which consumes production's own visibility and
 * enablement policy (see `search-action-bar-fake.tsx`). `onRender` receives the raw
 * props on every render so the suite can capture them.
 */
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

/**
 * A flat stand-in for `ResourceWorkspace`: all three slots, one parent, no responsive
 * behaviour. Suites that care *where* the slots mount use the real component instead
 * — see `resource-collection-actions.test.tsx`.
 */
export function flatResourceWorkspaceMock() {
  return {
    ResourceWorkspace: ({
      children,
      actionBar,
      sidePanel,
    }: {
      children: ReactNode;
      actionBar: ReactNode;
      sidePanel: ReactNode;
    }) => (
      <div>
        {actionBar}
        {children}
        {sidePanel}
      </div>
    ),
  };
}

/** Renders nothing but its test id; `onRender` captures the props it was given. */
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
