import type { ComponentProps, ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { WorkspacePickerDialog } from "@/components/workspace/workspace-picker-dialog";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import type {
  ListDirectoryInput,
  WorkspaceItem,
} from "@/lib/services/workspace/domain";
import { recentWorkspaceFoldersStorageKey } from "@/lib/recent-workspace-folders";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ user: { id: "alice", realm: "bvbrc" } }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

Element.prototype.scrollIntoView = vi.fn();

const home = "/alice@bvbrc/home";

function rootItem(
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

/**
 * The real `/` listing returns other users' workspaces with their own paths,
 * which the in-memory fixture (paths built from parent + name) cannot express.
 */
class PickerTestRepository extends InMemoryWorkspaceRepository {
  override listDirectory(input: ListDirectoryInput): Promise<WorkspaceItem[]> {
    if (input.path === "/") {
      return Promise.resolve([
        rootItem("/alice@bvbrc/home", { user: "o", global: "n" }),
        rootItem("/bob@bvbrc/shared-ws", { user: "w", global: "n" }),
        rootItem("/bob@bvbrc/readonly-ws", { user: "r", global: "n" }),
        rootItem("/carol@bvbrc/public-ws", { user: "r", global: "r" }),
      ]);
    }
    return super.listDirectory(input);
  }
}

function makeRepository(errors?: { createFolder?: Error }) {
  return new PickerTestRepository({
    directories: {
      "/alice@bvbrc": [
        { name: "home", type: "folder" },
        { name: "projects", type: "folder" },
      ],
      [home]: [
        { name: "Experiments", type: "folder" },
        { name: "Alpha", type: "folder" },
        { name: ".hidden", type: "folder" },
        { name: "reads.fq", type: "reads", size: 2048 },
        { name: "notes.txt", type: "txt", size: 12 },
      ],
      [`${home}/Experiments`]: [{ name: "Run1", type: "folder" }],
      "/bob@bvbrc/shared-ws": [
        { name: "inbox", type: "folder", userPermission: "w" },
      ],
      "/carol@bvbrc/public-ws": [
        {
          name: "data",
          type: "folder",
          userPermission: "r",
          globalPermission: "r",
        },
      ],
    },
    errors,
  });
}

type PickerProps = ComponentProps<typeof WorkspacePickerDialog>;

function renderPicker(
  overrides: Partial<PickerProps> = {},
  repository = makeRepository(),
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
  const props: PickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
  render(<WorkspacePickerDialog {...props} />, { wrapper: Wrapper });
  return { ...props, repository, user: userEvent.setup() };
}

function destination() {
  return screen.getByLabelText<HTMLInputElement>(/^Destination/);
}

function row(name: string) {
  const cell = screen.getByText(name);
  const element = cell.closest("tr");
  if (!element) throw new Error(`No row for ${name}`);
  return element;
}

async function switchView(
  user: ReturnType<typeof userEvent.setup>,
  view: string,
) {
  await user.click(screen.getByRole("combobox", { name: "Workspace view" }));
  await user.click(await screen.findByRole("option", { name: view }));
}

beforeEach(() => {
  localStorage.clear();
});

describe("WorkspacePickerDialog folder selection", () => {
  it("opens on Home and commits the folder being viewed", async () => {
    const { user, onSelect, onOpenChange } = renderPicker();

    await screen.findByText("Experiments");
    expect(destination().value).toBe(home);
    expect(screen.getByText("(currently viewing)")).toBeInTheDocument();
    expect(screen.queryByText("reads.fq")).not.toBeInTheDocument();
    expect(screen.queryByText(".hidden")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select" }));

    expect(onSelect).toHaveBeenCalledWith(home);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("commits a clicked folder", async () => {
    const { user, onSelect } = renderPicker();

    await user.click(await screen.findByText("Alpha"));
    expect(destination().value).toBe(`${home}/Alpha`);
    expect(row("Alpha")).toHaveAttribute("data-state", "selected");

    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(onSelect).toHaveBeenCalledWith(`${home}/Alpha`);
  });

  it("navigates on double click and back through the parent row", async () => {
    const { user } = renderPicker();

    await user.dblClick(await screen.findByText("Experiments"));
    await screen.findByText("Run1");
    expect(destination().value).toBe(`${home}/Experiments`);

    await user.click(screen.getByText("Parent folder"));
    await screen.findByText("Alpha");
    expect(destination().value).toBe(home);

    await user.click(screen.getByText("Back to My Workspaces"));
    await screen.findByText("projects");
    expect(destination().value).toBe("");
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
  });

  it("opens beside the current value with it selected", async () => {
    renderPicker({ initialPath: `${home}/Experiments` });

    await screen.findByText("Alpha");
    expect(destination().value).toBe(`${home}/Experiments`);
    expect(row("Experiments")).toHaveAttribute("data-state", "selected");
  });

  it("applies the caller's rule to the folder being viewed", async () => {
    const { user } = renderPicker({
      isSelectable: (object) => !object.name.startsWith("."),
    });

    await user.click(
      await screen.findByRole("checkbox", {
        name: "Show all files and folders",
      }),
    );
    await user.dblClick(await screen.findByText(".hidden"));

    expect(
      await screen.findByText("This folder can't be used here."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
  });

  it("reveals files and hidden items with show all", async () => {
    const { user } = renderPicker();

    await screen.findByText("Alpha");
    await user.click(
      screen.getByRole("checkbox", { name: "Show all files and folders" }),
    );

    expect(screen.getByText(".hidden")).toBeInTheDocument();
    expect(screen.getByText("notes.txt")).toBeInTheDocument();

    await user.click(screen.getByText("notes.txt"));
    expect(destination().value).toBe(home);
  });
});

describe("WorkspacePickerDialog switcher", () => {
  it("lists only writable shared workspaces and commits one", async () => {
    const { user, onSelect } = renderPicker();
    await screen.findByText("Alpha");

    await switchView(user, "Shared Workspaces");

    await screen.findByText("shared-ws");
    expect(screen.queryByText("readonly-ws")).not.toBeInTheDocument();

    await user.dblClick(screen.getByText("shared-ws"));
    await screen.findByText("inbox");
    expect(destination().value).toBe("/bob@bvbrc/shared-ws");
    expect(screen.getByText("Back to Shared Workspaces")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(onSelect).toHaveBeenCalledWith("/bob@bvbrc/shared-ws");
  });

  it("does not commit a read-only public workspace", async () => {
    const { user } = renderPicker();
    await screen.findByText("Alpha");

    await switchView(user, "Public Workspaces");
    await user.click(await screen.findByText("public-ws"));

    expect(
      screen.getByText("You don't have write access to this folder."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
  });

  it("lists recently used folders", async () => {
    localStorage.setItem(
      recentWorkspaceFoldersStorageKey,
      JSON.stringify([{ path: `${home}/Experiments`, visitedAt: 1 }]),
    );
    const { user, onSelect } = renderPicker();
    await screen.findByText("Alpha");

    await switchView(user, "Recently Used");
    await user.click(await screen.findByText("Experiments"));
    await user.click(screen.getByRole("button", { name: "Select" }));

    expect(onSelect).toHaveBeenCalledWith(`${home}/Experiments`);
  });

  it("lists favorite folders", async () => {
    server.use(
      http.post("*/api/services/workspace", () =>
        HttpResponse.json({
          jsonrpc: "2.0",
          id: 1,
          result: [
            [[["meta"], JSON.stringify({ folders: [`${home}/Alpha`] })]],
          ],
        }),
      ),
    );
    const { user } = renderPicker();
    await screen.findByText("Experiments");

    await switchView(user, "Favorites");

    await waitFor(() => {
      expect(screen.queryByText("Experiments")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });
});

describe("WorkspacePickerDialog folder creation", () => {
  async function openNewFolderPage() {
    const rendered = renderPicker();
    await screen.findByText("Alpha");
    await rendered.user.click(
      screen.getByRole("button", { name: "New folder" }),
    );
    return rendered;
  }

  it("opens new folder as a page of the picker, not a second dialog", async () => {
    await openNewFolderPage();

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      screen.getByRole("dialog", { name: "New Folder" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Folder name")).toHaveFocus();
    expect(screen.getByText(home)).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("creates the folder, returns to the list, and selects it", async () => {
    const { user, repository } = await openNewFolderPage();

    await user.type(screen.getByLabelText("Folder name"), "Results");
    await user.click(screen.getByRole("button", { name: "Create Folder" }));

    await screen.findByText("Results");
    expect(repository.calls).toContainEqual({
      method: "createFolder",
      path: `${home}/Results`,
    });
    expect(
      screen.getByRole("dialog", { name: "Select a Folder" }),
    ).toBeInTheDocument();
    expect(destination().value).toBe(`${home}/Results`);
  });

  it("creates on Enter", async () => {
    const { user, repository } = await openNewFolderPage();

    await user.type(screen.getByLabelText("Folder name"), "Results{Enter}");

    await screen.findByText("Results");
    expect(repository.calls).toContainEqual({
      method: "createFolder",
      path: `${home}/Results`,
    });
  });

  it("shows the backend's message on the page when creation fails", async () => {
    const { user } = renderPicker(
      {},
      makeRepository({ createFolder: new Error("Results already exists") }),
    );
    await screen.findByText("Alpha");
    await user.click(screen.getByRole("button", { name: "New folder" }));

    await user.type(screen.getByLabelText("Folder name"), "Results");
    await user.click(screen.getByRole("button", { name: "Create Folder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Results already exists",
    );
    expect(screen.getByLabelText("Folder name")).toBeInTheDocument();
  });

  it("rejects a folder name with a slash before calling the backend", async () => {
    const { user, repository } = await openNewFolderPage();

    await user.type(screen.getByLabelText("Folder name"), "a/b");

    expect(
      screen.getByText("Folder name cannot contain a slash."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Folder" })).toBeDisabled();
    expect(
      repository.calls.some((call) => call.method === "createFolder"),
    ).toBe(false);
  });

  it("goes back to the list from the back arrow and from Cancel", async () => {
    const { user } = await openNewFolderPage();

    await user.click(screen.getByRole("button", { name: "Back to folders" }));
    await screen.findByText("Alpha");
    expect(screen.getByRole("button", { name: "New folder" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByText("Alpha");
  });

  it("only offers folder actions inside a writable folder", async () => {
    const { user } = renderPicker();
    await screen.findByText("Alpha");
    expect(screen.getByRole("button", { name: "New folder" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Upload files" })).toBeEnabled();

    await switchView(user, "My Workspaces");
    await screen.findByText("projects");

    expect(screen.getByRole("button", { name: "New folder" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Upload files" })).toBeDisabled();
  });
});

describe("WorkspacePickerDialog upload", () => {
  it("opens upload as a page for the folder being viewed", async () => {
    const { user } = renderPicker();
    await screen.findByText("Alpha");

    await user.click(screen.getByRole("button", { name: "Upload files" }));

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Upload" })).toBeInTheDocument();
    expect(screen.getByText(home)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to folders" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Start Upload" })).toBeDisabled();
  });

  it("returns to the same folder from the back arrow", async () => {
    const { user } = renderPicker();
    await user.dblClick(await screen.findByText("Experiments"));
    await screen.findByText("Run1");

    await user.click(screen.getByRole("button", { name: "Upload files" }));
    expect(screen.getByText(`${home}/Experiments`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to folders" }));

    await screen.findByText("Run1");
    expect(destination().value).toBe(`${home}/Experiments`);
  });
});

describe("WorkspacePickerDialog file selection", () => {
  it("selects only files of the requested types and commits on double click", async () => {
    const { user, onSelect, onOpenChange } = renderPicker({
      target: { kind: "object", types: ["reads"] },
    });

    expect(
      await screen.findByRole("dialog", { name: "Select a File" }),
    ).toBeInTheDocument();
    await screen.findByText("reads.fq");
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();

    await user.click(screen.getByText("Alpha"));
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();

    await user.dblClick(screen.getByText("reads.fq"));

    expect(onSelect).toHaveBeenCalledWith(`${home}/reads.fq`);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
