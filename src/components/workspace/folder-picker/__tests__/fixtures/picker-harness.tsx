/**
 * Shared harness for the folder picker's component tests: an in-memory
 * workspace with a `/` listing of other users' workspaces, hooks to hold or
 * fail individual backend calls, and a host that really opens and closes the
 * dialog. Each test file still mocks `@/lib/auth/provider` and `sonner`
 * itself, because `vi.mock` only applies to the file that calls it.
 */

import { useState, type ComponentProps, type ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceFolderPickerDialog } from "@/components/workspace/folder-picker/folder-picker-dialog";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import {
  InMemoryWorkspaceRepository,
  type InMemoryFixtures,
} from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import type {
  ListDirectoryInput,
  WorkspaceItem,
} from "@/lib/services/workspace/domain";
import type {
  UploadNodeRequest,
  UploadNodeResult,
} from "@/lib/services/workspace/workspace-repository";
import { createQueryClientWrapper } from "@/test-helpers/react";

export const pickerUser = { id: "alice", realm: "bvbrc" };
export const pickerHome = "/alice@bvbrc/home";

/**
 * jsdom has no element scrolling (`Element.scrollTo`), no pointer capture, no
 * `matchMedia` and no Web Animations API. Reporting reduced motion keeps the
 * column animations out of the component tests;
 * `folder-picker-motion.test.ts` covers them.
 */
export function stubPickerBrowserApis() {
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: true }),
  });
}

export interface Gate {
  promise: Promise<undefined>;
  release: () => void;
  fail: (error: Error) => void;
}

function createGate(): Gate {
  const { promise, resolve, reject } = Promise.withResolvers<undefined>();
  return {
    promise,
    release: () => {
      resolve(undefined);
    },
    fail: reject,
  };
}

export function rootItem(
  path: string,
  permissions: WorkspaceItem["permissions"],
): WorkspaceItem {
  return {
    id: path,
    name: path.split("/").pop() ?? "",
    path,
    type: "folder",
    size: 0,
    ownerId: path.split("/")[1],
    permissions,
  };
}

const defaultRootItems = [
  rootItem(pickerHome, { user: "o", global: "n" }),
  rootItem("/bob@bvbrc/shared-ws", { user: "w", global: "n" }),
  rootItem("/bob@bvbrc/readonly-ws", { user: "r", global: "n" }),
  rootItem("/carol@bvbrc/public-ws", { user: "r", global: "r" }),
];

/**
 * The real `/` listing returns other users' workspaces with their own paths,
 * which the in-memory fixture (paths built from parent + name) cannot
 * express, so it is overridden here. Listings, folder creation and uploads
 * can also be held open or failed, to see the picker while they are pending.
 */
export class PickerTestRepository extends InMemoryWorkspaceRepository {
  rootItems: WorkspaceItem[] = defaultRootItems;
  private listingGates = new Map<string, Gate>();
  private listingFailures = new Map<string, Error>();
  private createFolderGate: Gate | null = null;
  private uploadGate: Gate | null = null;

  /** Every listing of `path` waits until the gate is released. */
  holdListing(path: string): Gate {
    const gate = createGate();
    this.listingGates.set(path, gate);
    return gate;
  }

  /** Every listing of `path` fails with `error`. */
  failListing(path: string, error: Error) {
    this.listingFailures.set(path, error);
  }

  /** The next folder creation waits until the gate is released. */
  holdCreateFolder(): Gate {
    this.createFolderGate = createGate();
    return this.createFolderGate;
  }

  /** The next upload waits (before its first request) until released. */
  holdUpload(): Gate {
    this.uploadGate = createGate();
    return this.uploadGate;
  }

  override async listDirectory(
    input: ListDirectoryInput,
  ): Promise<WorkspaceItem[]> {
    const gate = this.listingGates.get(input.path);
    if (gate) await gate.promise;
    const failure = this.listingFailures.get(input.path);
    if (failure) throw failure;
    if (input.path === "/") return this.rootItems;
    return super.listDirectory(input);
  }

  override async createFolder(path: string): Promise<void> {
    const gate = this.createFolderGate;
    this.createFolderGate = null;
    if (gate) await gate.promise;
    return super.createFolder(path);
  }

  override async createUploadNode(
    input: UploadNodeRequest,
  ): Promise<UploadNodeResult> {
    const gate = this.uploadGate;
    this.uploadGate = null;
    if (gate) await gate.promise;
    return super.createUploadNode(input);
  }
}

export const defaultPickerDirectories: InMemoryFixtures["directories"] = {
  "/alice@bvbrc": [
    { name: "home", type: "folder" },
    { name: "projects", type: "folder" },
  ],
  [pickerHome]: [
    { name: "Experiments", type: "folder", createdAt: "2026-02-03T10:00:00Z" },
    { name: "Alpha", type: "folder" },
    { name: ".hidden", type: "folder" },
    { name: "reads.fq", type: "reads", size: 2048 },
  ],
  [`${pickerHome}/Experiments`]: [{ name: "Run1", type: "folder" }],
  [`${pickerHome}/Experiments/Run1`]: [],
  [`${pickerHome}/Alpha`]: [],
  "/carol@bvbrc/public-ws": [
    {
      name: "data",
      type: "folder",
      ownerId: "carol@bvbrc",
      userPermission: "r",
      globalPermission: "r",
    },
  ],
};

export function makePickerRepository(
  fixtures: InMemoryFixtures = {},
): PickerTestRepository {
  return new PickerTestRepository({
    directories: defaultPickerDirectories,
    ...fixtures,
  });
}

type PickerProps = ComponentProps<typeof WorkspaceFolderPickerDialog>;
type HostProps = Omit<PickerProps, "open">;

/** Owns `open` the way a caller does, so Close really closes the dialog. */
function PickerHost(props: HostProps) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open picker
      </button>
      <WorkspaceFolderPickerDialog
        {...props}
        open={open}
        onOpenChange={(next) => {
          props.onOpenChange(next);
          setOpen(next);
        }}
      />
    </>
  );
}

export function renderPicker(
  overrides: Partial<HostProps> = {},
  repository: PickerTestRepository = makePickerRepository(),
) {
  const QueryWrapper = createQueryClientWrapper();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <WorkspaceRepositoryProvider
          value={{ authenticated: repository, public: repository }}
        >
          {children}
        </WorkspaceRepositoryProvider>
      </QueryWrapper>
    );
  }
  const props: HostProps = {
    onOpenChange: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
  render(<PickerHost {...props} />, { wrapper: Wrapper });
  const user = userEvent.setup();
  return {
    ...props,
    repository,
    user,
    /** Opens the dialog again after it closed. */
    reopen: async () => {
      await user.click(screen.getByRole("button", { name: "Open picker" }));
    },
  };
}

export async function findOption(
  columnName: string,
  optionName: string | RegExp,
) {
  const column = await screen.findByRole("listbox", { name: columnName });
  return within(column).findByRole("option", { name: optionName });
}

/** The footer's Select button: "Select" or "Select “Name”". */
export function selectButton() {
  return screen.getByRole("button", { name: /^Select( “.*”)?$/ });
}

export function breadcrumb() {
  return screen.getByRole("navigation", { name: "Selected folder" });
}

export function breadcrumbLabels() {
  return within(breadcrumb())
    .getAllByRole("button")
    .map((crumb) => crumb.textContent);
}

/** Column headers in order, read from their resize handles. */
export function columnLabels() {
  return screen
    .getAllByRole("separator", { name: /^Resize .* column$/ })
    .map((handle) =>
      (handle.getAttribute("aria-label") ?? "")
        .replace(/^Resize /, "")
        .replace(/ column$/, ""),
    );
}
