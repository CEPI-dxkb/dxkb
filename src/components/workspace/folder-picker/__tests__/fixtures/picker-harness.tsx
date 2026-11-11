/**
 * Each test file must still mock `@/lib/auth/provider` and `sonner`, because `vi.mock`
 * only applies to the file that calls it.
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
 * jsdom has no Element.scrollTo, pointer capture, matchMedia or Web Animations API;
 * reporting reduced motion keeps column animations out of the component tests.
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
 * The real `/` listing returns other users' workspaces with their own paths, which the
 * in-memory fixture cannot express, so it is overridden here.
 */
export class PickerTestRepository extends InMemoryWorkspaceRepository {
  rootItems: WorkspaceItem[] = defaultRootItems;
  private listingGates = new Map<string, Gate>();
  private listingFailures = new Map<string, Error>();
  private createFolderGate: Gate | null = null;
  private uploadGate: Gate | null = null;
  private addedItems = new Map<string, WorkspaceItem[]>();

  addItem(
    parentPath: string,
    item: Pick<WorkspaceItem, "name" | "type"> & Partial<WorkspaceItem>,
  ) {
    const path = `${parentPath}/${item.name}`;
    const added = { id: path, path, size: 0, ...item };
    this.addedItems.set(parentPath, [
      ...(this.addedItems.get(parentPath) ?? []),
      added,
    ]);
  }

  holdListing(path: string): Gate {
    const gate = createGate();
    this.listingGates.set(path, gate);
    return gate;
  }

  failListing(path: string, error: Error) {
    this.listingFailures.set(path, error);
  }

  restoreListing(path: string) {
    this.listingFailures.delete(path);
  }

  holdCreateFolder(): Gate {
    this.createFolderGate = createGate();
    return this.createFolderGate;
  }

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
    return [
      ...(await super.listDirectory(input)),
      ...(this.addedItems.get(input.path) ?? []),
    ];
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

export const filePickerDirectories: InMemoryFixtures["directories"] = {
  ...defaultPickerDirectories,
  [pickerHome]: [
    ...(defaultPickerDirectories[pickerHome] ?? []),
    { name: "Assembly1", type: "job_result" },
    { name: "draft.fasta", type: "contigs", size: 4096 },
    { name: "notes.txt", type: "txt", size: 10 },
  ],
  [`${pickerHome}/.Assembly1`]: [
    { name: "Assembly1_contigs.fasta", type: "contigs", size: 8192 },
    { name: "report.html", type: "html", size: 300 },
  ],
  "/carol@bvbrc/public-ws/data": [{ name: "lab.fasta", type: "contigs" }],
};

export function makeFilePickerRepository(): PickerTestRepository {
  return makePickerRepository({ directories: filePickerDirectories });
}

export function pickerRepositoryWrapper(
  repository: PickerTestRepository = makePickerRepository(),
) {
  const QueryWrapper = createQueryClientWrapper();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <WorkspaceRepositoryProvider
          value={{ authenticated: repository, public: repository }}
        >
          {children}
        </WorkspaceRepositoryProvider>
      </QueryWrapper>
    );
  };
}

type PickerProps = ComponentProps<typeof WorkspaceFolderPickerDialog>;
type HostProps = Omit<PickerProps, "open">;

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
  const Wrapper = pickerRepositoryWrapper(repository);
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

export function selectButton() {
  return screen.getByRole("button", { name: /^Select( “.*”)?$/ });
}

export function breadcrumb() {
  return screen.getByRole("navigation", { name: /^Selected (folder|file)$/ });
}

export function breadcrumbLabels() {
  return within(breadcrumb())
    .getAllByRole("button")
    .map((crumb) => crumb.textContent);
}

export function columnLabels() {
  return screen
    .getAllByRole("separator", { name: /^Resize .* column$/ })
    .map((handle) =>
      (handle.getAttribute("aria-label") ?? "")
        .replace(/^Resize /, "")
        .replace(/ column$/, ""),
    );
}
