import type { ComponentProps, ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { WorkspaceFolderPickerDialog } from "@/components/workspace/folder-picker/folder-picker-dialog";
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

// jsdom has no element scrolling, and reporting reduced motion keeps the
// column animations (Web Animations API, also missing) out of these tests.
Element.prototype.scrollTo = vi.fn();
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: () => ({ matches: true }),
});

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
      ],
      [`${home}/Experiments`]: [{ name: "Run1", type: "folder" }],
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

type PickerProps = ComponentProps<typeof WorkspaceFolderPickerDialog>;

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
  render(<WorkspaceFolderPickerDialog {...props} />, { wrapper: Wrapper });
  return { ...props, repository, user: userEvent.setup() };
}

async function findOption(columnName: string, optionName: string | RegExp) {
  const column = await screen.findByRole("listbox", { name: columnName });
  return within(column).findByRole("option", { name: optionName });
}

function selectButton() {
  return screen.getByRole("button", { name: /^Select/ });
}

beforeEach(() => {
  localStorage.clear();
});

describe("WorkspaceFolderPickerDialog choosing a folder", () => {
  it("opens on Home with only visible folders and commits Home", async () => {
    const { user, onSelect, onOpenChange } = renderPicker();

    await findOption("Home", "Alpha");
    expect(screen.queryByText("reads.fq")).not.toBeInTheDocument();
    expect(screen.queryByText(".hidden")).not.toBeInTheDocument();
    expect(selectButton()).toHaveAccessibleName("Select “Home”");

    await user.click(selectButton());

    expect(onSelect).toHaveBeenCalledWith(home);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens a clicked folder in the next column and commits it", async () => {
    const { user, onSelect } = renderPicker();

    await user.click(await findOption("Home", "Experiments"));
    expect(await findOption("Experiments", "Run1")).toBeInTheDocument();
    expect(selectButton()).toHaveAccessibleName("Select “Experiments”");

    await user.click(selectButton());
    expect(onSelect).toHaveBeenCalledWith(`${home}/Experiments`);
  });

  it("commits a folder on double click", async () => {
    const { user, onSelect } = renderPicker();

    await user.dblClick(await findOption("Home", "Alpha"));

    expect(onSelect).toHaveBeenCalledWith(`${home}/Alpha`);
  });

  it("walks the columns with the arrow keys and commits with Enter", async () => {
    const { user, onSelect } = renderPicker();

    await user.click(await findOption("Home", "Alpha"));
    await user.keyboard("{ArrowDown}");
    expect(selectButton()).toHaveAccessibleName("Select “Experiments”");

    await findOption("Experiments", "Run1");
    await user.keyboard("{ArrowRight}");
    await waitFor(() => {
      expect(selectButton()).toHaveAccessibleName("Select “Run1”");
    });

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => {
      expect(selectButton()).toHaveAccessibleName("Select “Experiments”");
    });

    await user.keyboard("{ArrowRight}{Enter}");
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(`${home}/Experiments/Run1`);
    });
  });

  it("opens with the current value selected and its full path shown", async () => {
    renderPicker({ initialPath: `${home}/Experiments/Run1` });

    expect(await findOption("Experiments", "Run1")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const breadcrumb = screen.getByRole("navigation", {
      name: "Selected folder",
    });
    expect(
      within(breadcrumb)
        .getAllByRole("button")
        .map((crumb) => crumb.textContent),
    ).toEqual(["Home", "Experiments", "Run1"]);
    expect(selectButton()).toHaveAccessibleName("Select “Run1”");
  });

  it("jumps back to a folder from the breadcrumb", async () => {
    const { user } = renderPicker({ initialPath: `${home}/Experiments/Run1` });
    await findOption("Experiments", "Run1");

    const breadcrumb = screen.getByRole("navigation", {
      name: "Selected folder",
    });
    await user.click(
      within(breadcrumb).getByRole("button", { name: "Experiments" }),
    );

    expect(selectButton()).toHaveAccessibleName("Select “Experiments”");
  });

  it("explains a folder the caller rejects", async () => {
    const { user } = renderPicker({
      isSelectable: (object) => object.name !== "Alpha",
    });

    await user.click(await findOption("Home", "Alpha"));

    expect(
      screen.getByText("This folder can't be used here."),
    ).toBeInTheDocument();
    expect(selectButton()).toBeDisabled();
  });
});

describe("WorkspaceFolderPickerDialog places", () => {
  it("lists only writable shared workspaces", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(screen.getByRole("button", { name: "Shared Workspaces" }));

    expect(
      await findOption("Shared Workspaces", /shared-ws/),
    ).toBeInTheDocument();
    expect(screen.queryByText("readonly-ws")).not.toBeInTheDocument();
  });

  it("browses public workspaces but cannot commit them", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(screen.getByRole("button", { name: "Public Workspaces" }));
    await user.click(await findOption("Public Workspaces", /public-ws/));

    expect(await findOption("public-ws", /data/)).toBeInTheDocument();
    expect(
      screen.getByText("You don't have write access to this folder."),
    ).toBeInTheDocument();
    expect(selectButton()).toBeDisabled();
  });

  it("lists recently used folders", async () => {
    localStorage.setItem(
      recentWorkspaceFoldersStorageKey,
      JSON.stringify([{ path: `${home}/Experiments`, visitedAt: 1 }]),
    );
    const { user, onSelect } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(screen.getByRole("button", { name: "Recently Used" }));
    await user.click(await findOption("Recently Used", "Experiments"));
    await user.click(selectButton());

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
    await findOption("Home", "Alpha");

    await user.click(screen.getByRole("button", { name: "Favorites" }));

    expect(await findOption("Favorites", "Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Experiments")).not.toBeInTheDocument();
  });
});

describe("WorkspaceFolderPickerDialog new folder", () => {
  async function startNewFolder(repository = makeRepository()) {
    const rendered = renderPicker({}, repository);
    await rendered.user.click(await findOption("Home", "Alpha"));
    await rendered.user.click(
      screen.getByRole("button", { name: "New folder here" }),
    );
    const input = await screen.findByRole("textbox", {
      name: "New folder name",
    });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    return { ...rendered, input };
  }

  it("creates the folder in the selected folder and selects it", async () => {
    const { user, repository } = await startNewFolder();

    await user.keyboard("Results{Enter}");

    await waitFor(() => {
      expect(selectButton()).toHaveAccessibleName("Select “Results”");
    });
    expect(repository.calls).toContainEqual({
      method: "createFolder",
      path: `${home}/Alpha/Results`,
    });
  });

  it("cancels with Escape without closing the picker", async () => {
    const { user, onOpenChange } = await startNewFolder();

    await user.keyboard("Draft{Escape}");

    expect(
      screen.queryByRole("textbox", { name: "New folder name" }),
    ).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("checks the name before creating", async () => {
    const { user, repository } = await startNewFolder();

    await user.keyboard("a/b{Enter}");

    expect(
      screen.getByText("Folder name cannot contain a slash."),
    ).toBeInTheDocument();
    expect(repository.calls).not.toContainEqual(
      expect.objectContaining({ method: "createFolder" }),
    );
  });

  it("shows the backend's error message", async () => {
    const { user } = await startNewFolder(
      makeRepository({ createFolder: new Error("Folder already exists") }),
    );

    await user.keyboard("Results{Enter}");

    expect(
      await screen.findByText("Folder already exists"),
    ).toBeInTheDocument();
  });
});

describe("WorkspaceFolderPickerDialog panes", () => {
  it("shows files on request but never hidden items", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(screen.getByRole("button", { name: "Show files" }));

    expect(await findOption("Home", /reads\.fq/)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.queryByText(".hidden")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide files" }),
    ).toBeInTheDocument();
  });

  it("swaps the info pane for the upload form and back", async () => {
    const { user } = renderPicker();
    await user.click(await findOption("Home", "Alpha"));

    await user.click(screen.getByRole("button", { name: "Upload here" }));
    expect(screen.getByText(`${home}/Alpha`)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start Upload" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Back to folder info" }),
    );
    expect(
      screen.getByRole("button", { name: "Upload here" }),
    ).toBeInTheDocument();
  });

  it("resizes a column from the keyboard", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");
    const handle = screen.getByRole("separator", {
      name: "Resize Home column",
    });
    expect(handle).toHaveAttribute("aria-valuenow", "180");

    handle.focus();
    await user.keyboard("{ArrowRight}");

    expect(handle).toHaveAttribute("aria-valuenow", "196");
  });
});
