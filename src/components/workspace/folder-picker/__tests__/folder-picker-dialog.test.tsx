import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { recentWorkspaceFoldersStorageKey } from "@/lib/recent-workspace-folders";
import { formatDate } from "@/lib/services/workspace/helpers";
import { server } from "@/test-helpers/msw-server";
import {
  breadcrumbLabels,
  breadcrumb,
  columnLabels,
  defaultPickerDirectories,
  findOption,
  makePickerRepository,
  pickerHome as home,
  pickerUser,
  renderPicker,
  selectButton,
  stubPickerBrowserApis,
} from "./fixtures/picker-harness";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ user: pickerUser }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

stubPickerBrowserApis();

/** The value the info pane shows for a detail, e.g. "Where" → "Home". */
function detail(term: string) {
  return screen.getByText(term, { selector: "dt" }).nextElementSibling
    ?.textContent;
}

function place(name: string) {
  return within(screen.getByRole("navigation", { name: "Places" })).getByRole(
    "button",
    { name },
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("WorkspaceFolderPickerDialog opening and closing", () => {
  it("uses the default title and explains how to choose", async () => {
    renderPicker();

    expect(
      await screen.findByRole("dialog", { name: "Select a Folder" }),
    ).toHaveAccessibleDescription(
      "Click a folder to open it. Double-click it, or press Enter, to choose it.",
    );
  });

  it("uses the caller's title", async () => {
    renderPicker({ title: "Select an Output Folder" });

    expect(
      await screen.findByRole("dialog", { name: "Select an Output Folder" }),
    ).toBeInTheDocument();
  });

  it("closes from the header's close button without choosing", async () => {
    const { user, onOpenChange, onSelect } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes from Cancel without choosing", async () => {
    const { user, onOpenChange, onSelect } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const { user, onOpenChange } = renderPicker();
    await waitFor(async () => {
      expect(await findOption("Home", "Alpha")).toHaveFocus();
    });

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("starts fresh on every open but keeps the layout", async () => {
    const { user, reopen } = renderPicker();
    await user.click(await findOption("Home", "Experiments"));
    await user.click(screen.getByRole("button", { name: "Show files" }));
    screen.getByRole("separator", { name: "Resize Home column" }).focus();
    await user.keyboard("{ArrowRight}");
    screen.getByRole("separator", { name: "Resize info pane" }).focus();
    await user.keyboard("{ArrowLeft}");

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await reopen();

    await findOption("Home", "Alpha");
    // The selection and the open columns reset ...
    expect(selectButton()).toHaveAccessibleName("Select “Home”");
    expect(columnLabels()).toEqual(["Home"]);
    // ... while Show files and the widths the user set are kept.
    expect(
      screen.getByRole("button", { name: "Hide files", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: "Resize Home column" }),
    ).toHaveAttribute("aria-valuenow", "256");
    expect(
      screen.getByRole("separator", { name: "Resize info pane" }),
    ).toHaveAttribute("aria-valuenow", "336");
  });
});

describe("WorkspaceFolderPickerDialog choosing a folder", () => {
  it("opens on Home with only visible folders and commits Home", async () => {
    const { user, onSelect, onOpenChange } = renderPicker();

    await findOption("Home", "Alpha");
    expect(screen.queryByText("reads.fq")).not.toBeInTheDocument();
    expect(screen.queryByText(".hidden")).not.toBeInTheDocument();
    expect(selectButton()).toHaveAccessibleName("Select “Home”");

    await user.click(selectButton());

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(home);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("opens a clicked folder in the next column and commits it", async () => {
    const { user, onSelect } = renderPicker();

    await user.click(await findOption("Home", "Experiments"));
    expect(await findOption("Experiments", "Run1")).toBeInTheDocument();
    expect(columnLabels()).toEqual(["Home", "Experiments"]);
    expect(selectButton()).toHaveAccessibleName("Select “Experiments”");

    await user.click(selectButton());
    expect(onSelect).toHaveBeenCalledWith(`${home}/Experiments`);
  });

  it("commits a folder on double click", async () => {
    const { user, onSelect } = renderPicker();

    await user.dblClick(await findOption("Home", "Alpha"));

    expect(onSelect).toHaveBeenCalledWith(`${home}/Alpha`);
  });

  it("does not commit a read-only folder on double click", async () => {
    const { user, onSelect } = renderPicker();
    await findOption("Home", "Alpha");
    await user.click(place("Public Workspaces"));

    await user.dblClick(await findOption("Public Workspaces", /public-ws/));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens with the current value selected and its full path shown", async () => {
    renderPicker({ initialPath: `${home}/Experiments/Run1` });

    expect(await findOption("Experiments", "Run1")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await findOption("Home", "Experiments")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(columnLabels()).toEqual(["Home", "Experiments", "Run1"]);
    expect(breadcrumbLabels()).toEqual(["Home", "Experiments", "Run1"]);
    expect(selectButton()).toHaveAccessibleName("Select “Run1”");
  });

  it("opens on My Workspaces for a value in another of the user's workspaces", async () => {
    renderPicker({ initialPath: "/alice@bvbrc/projects" });

    expect(await findOption("My Workspaces", "projects")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(place("My Workspaces")).toHaveAttribute("aria-current", "true");
    expect(breadcrumbLabels()).toEqual(["My Workspaces", "projects"]);
  });

  it("opens on Shared Workspaces for a value in someone else's workspace", async () => {
    renderPicker({ initialPath: "/bob@bvbrc/shared-ws" });

    expect(
      await findOption("Shared Workspaces", /shared-ws/),
    ).toHaveAttribute("aria-selected", "true");
    expect(place("Shared Workspaces")).toHaveAttribute("aria-current", "true");
    expect(selectButton()).toHaveAccessibleName("Select “shared-ws”");
  });

  it("opens on Home for a value that is not inside a workspace", async () => {
    renderPicker({ initialPath: "/alice@bvbrc" });

    await findOption("Home", "Alpha");
    expect(place("Home")).toHaveAttribute("aria-current", "true");
    expect(selectButton()).toHaveAccessibleName("Select “Home”");
  });

  it("jumps back to a folder from the breadcrumb, closing the columns past it", async () => {
    const { user } = renderPicker({ initialPath: `${home}/Experiments/Run1` });
    await findOption("Experiments", "Run1");

    await user.click(
      within(breadcrumb()).getByRole("button", { name: "Experiments" }),
    );

    expect(selectButton()).toHaveAccessibleName("Select “Experiments”");
    expect(columnLabels()).toEqual(["Home", "Experiments"]);
    expect(breadcrumbLabels()).toEqual(["Home", "Experiments"]);
  });

  it("jumps to the place itself from the first crumb", async () => {
    const { user } = renderPicker({ initialPath: `${home}/Experiments/Run1` });
    await findOption("Experiments", "Run1");

    await user.click(within(breadcrumb()).getByRole("button", { name: "Home" }));

    expect(selectButton()).toHaveAccessibleName("Select “Home”");
    expect(columnLabels()).toEqual(["Home"]);
  });

  it("closes the columns past a folder chosen higher up", async () => {
    const { user } = renderPicker({ initialPath: `${home}/Experiments/Run1` });
    await findOption("Experiments", "Run1");

    await user.click(await findOption("Home", "Alpha"));

    expect(columnLabels()).toEqual(["Home", "Alpha"]);
    expect(breadcrumbLabels()).toEqual(["Home", "Alpha"]);
    expect(await findOption("Home", "Experiments")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("explains a folder the caller rejects", async () => {
    const isSelectable = vi.fn(
      (object: { name: string; path: string }) => object.name !== "Alpha",
    );
    const { user } = renderPicker({ isSelectable });

    await user.click(await findOption("Home", "Alpha"));

    expect(isSelectable).toHaveBeenCalledWith({
      name: "Alpha",
      path: `${home}/Alpha`,
    });
    expect(
      screen.getByText("This folder can't be used here."),
    ).toBeInTheDocument();
    expect(selectButton()).toBeDisabled();
  });

  it("names the home folder Home wherever it shows", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");
    await user.click(place("My Workspaces"));

    await user.click(await findOption("My Workspaces", "home"));

    expect(await findOption("Home", "Alpha")).toBeInTheDocument();
    expect(columnLabels()).toEqual(["My Workspaces", "Home"]);
    expect(breadcrumbLabels()).toEqual(["My Workspaces", "Home"]);
    expect(selectButton()).toHaveAccessibleName("Select “Home”");
  });
});

describe("WorkspaceFolderPickerDialog places", () => {
  it("marks the open place and starts it with nothing selected", async () => {
    const { user } = renderPicker();
    await user.click(await findOption("Home", "Experiments"));

    await user.click(place("My Workspaces"));

    expect(place("My Workspaces")).toHaveAttribute("aria-current", "true");
    expect(place("Home")).not.toHaveAttribute("aria-current");
    expect(await findOption("My Workspaces", "projects")).toBeInTheDocument();
    expect(columnLabels()).toEqual(["My Workspaces"]);
    expect(breadcrumbLabels()).toEqual(["My Workspaces"]);
    expect(selectButton()).toHaveAccessibleName("Select");
    expect(selectButton()).toBeDisabled();
    expect(
      screen.getByText("Pick one of your workspaces to see its folders."),
    ).toBeInTheDocument();
  });

  it("lists only writable shared workspaces, with their owners", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(place("Shared Workspaces"));

    expect(await findOption("Shared Workspaces", /shared-ws/)).toHaveTextContent(
      "bob",
    );
    expect(screen.queryByText("readonly-ws")).not.toBeInTheDocument();
    // Your own home is in the `/` listing too, but it isn't shared with you.
    expect(screen.queryByText("home")).not.toBeInTheDocument();
  });

  it("browses public workspaces but cannot commit them", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(place("Public Workspaces"));
    await user.click(await findOption("Public Workspaces", /public-ws/));

    expect(await findOption("public-ws", /data/)).toBeInTheDocument();
    expect(
      screen.getByText("You don't have write access to this folder."),
    ).toBeInTheDocument();
    expect(selectButton()).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "New folder here" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Upload here" })).toBeDisabled();
  });

  it("lists recently used folders, newest first", async () => {
    localStorage.setItem(
      recentWorkspaceFoldersStorageKey,
      JSON.stringify([
        { path: `${home}/Experiments`, visitedAt: 2 },
        { path: `${home}/Alpha`, visitedAt: 1 },
        { path: "/bob@bvbrc/shared-ws/elsewhere", visitedAt: 3 },
      ]),
    );
    const { user, onSelect } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(place("Recently Used"));
    const column = await screen.findByRole("listbox", {
      name: "Recently Used",
    });

    // Stored order, not alphabetical; another user's entries are left out.
    expect(
      within(column)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Experiments", "Alpha"]);
    await user.click(within(column).getByRole("option", { name: "Experiments" }));
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

    await user.click(place("Favorites"));

    expect(await findOption("Favorites", "Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Experiments")).not.toBeInTheDocument();
  });

  it("chooses a favorite in another user's writable workspace", async () => {
    const results = "/bob@bvbrc/shared-ws/Results";
    const docs = "/bob@bvbrc/readonly-ws/Docs";
    server.use(
      http.post("*/api/services/workspace", () =>
        HttpResponse.json({
          jsonrpc: "2.0",
          id: 1,
          result: [[[["meta"], JSON.stringify({ folders: [results, docs] })]]],
        }),
      ),
    );
    const { user, onSelect } = renderPicker(
      {},
      makePickerRepository({
        directories: {
          ...defaultPickerDirectories,
          [results]: [],
          [docs]: [],
        },
      }),
    );
    await findOption("Home", "Alpha");
    await user.click(place("Favorites"));

    // A favorite is only a path; its workspace's row says what the user may do.
    await user.click(await findOption("Favorites", /^Docs/));
    expect(
      await screen.findByText("You don't have write access to this folder."),
    ).toBeInTheDocument();
    expect(selectButton()).toBeDisabled();

    await user.click(await findOption("Favorites", "Results"));
    expect(
      await screen.findByText(
        "You can write here, so results can be saved in this folder.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New folder here" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Upload here" })).toBeEnabled();
    await user.click(selectButton());

    expect(onSelect).toHaveBeenCalledWith(results);
  });
  // `team-ws` and `locked-ws` are not in the `/` listing, so their favorites
  // are stubs with no permission; their own listings carry it.
  const reports = "/dave@bvbrc/team-ws/Reports";
  const notes = "/erin@bvbrc/locked-ws/Notes";
  function renderFavorites(folders: string[]) {
    server.use(
      http.post("*/api/services/workspace", () =>
        HttpResponse.json({
          jsonrpc: "2.0",
          id: 1,
          result: [[[["meta"], JSON.stringify({ folders })]]],
        }),
      ),
    );
    const child = (name: string, userPermission: string) => ({
      name,
      type: "folder" as const,
      userPermission,
      globalPermission: "n",
    });
    return renderPicker(
      {},
      makePickerRepository({
        directories: {
          ...defaultPickerDirectories,
          "/bob@bvbrc/shared-ws/Results": [],
          [reports]: [child("Q3", "w")],
          [notes]: [child("Drafts", "r")],
        },
      }),
    );
  }

  it("chooses a favorite whose permission only its own listing carries", async () => {
    const { user, onSelect } = renderFavorites([reports]);
    await findOption("Home", "Alpha");
    await user.click(place("Favorites"));

    await user.click(await findOption("Favorites", /^Reports/));
    await findOption("Reports", "Q3");
    // The exact name: no "(read-only)" once the listing has loaded.
    const row = await findOption("Favorites", "Reports");
    expect(selectButton()).toBeEnabled();
    await user.dblClick(row);

    expect(onSelect).toHaveBeenCalledWith(reports);
  });

  it("does not borrow another workspace's permission for a favorite", async () => {
    const { user, onSelect } = renderFavorites([
      "/bob@bvbrc/shared-ws/Results",
      notes,
    ]);
    await findOption("Home", "Alpha");
    await user.click(place("Favorites"));

    await user.click(await findOption("Favorites", /^Notes/));
    await findOption("Notes", /^Drafts/);
    expect(
      await findOption("Favorites", /^Notes\s*\(read-only\)$/),
    ).toBeInTheDocument();
    expect(selectButton()).toBeDisabled();
    await user.dblClick(await findOption("Favorites", /^Notes/));

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("WorkspaceFolderPickerDialog info pane", () => {
  it("describes the selected folder", async () => {
    const { user } = renderPicker();

    await user.click(await findOption("Home", "Experiments"));
    await findOption("Experiments", "Run1");

    expect(screen.getByText(`${home}/Experiments`)).toBeInTheDocument();
    expect(detail("Where")).toBe("Home");
    expect(detail("Owner")).toBe("test-user");
    expect(detail("Created")).toBe(formatDate("2026-02-03T10:00:00Z"));
    expect(detail("Contains")).toBe("1 folder, 0 files");
    expect(
      screen.getByText(
        "You can write here, so results can be saved in this folder.",
      ),
    ).toBeInTheDocument();
  });

  it("counts what the folder holds, leaving out hidden items", async () => {
    renderPicker();

    await findOption("Home", "Alpha");

    expect(screen.getByText(home)).toBeInTheDocument();
    expect(detail("Contains")).toBe("2 folders, 1 file");
  });

  it("says when a folder holds nothing", async () => {
    const { user } = renderPicker();

    await user.click(await findOption("Home", "Alpha"));

    expect(await screen.findByText("This folder is empty.")).toBeInTheDocument();
    expect(detail("Contains")).toBe("Nothing yet");
  });

  it("describes a place while no folder in it is selected", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(place("Recently Used"));

    expect(
      screen.getByText("Folders you used recently, newest first."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New folder here" }),
    ).not.toBeInTheDocument();
  });
});

describe("WorkspaceFolderPickerDialog Show files and widths", () => {
  it("shows files on request but never hidden items", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(
      screen.getByRole("button", { name: "Show files", pressed: false }),
    );

    const file = await findOption("Home", /reads\.fq/);
    expect(file).toHaveAttribute("aria-disabled", "true");
    expect(file).toHaveTextContent("2.0 KB");
    expect(screen.queryByText(".hidden")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Hide files", pressed: true }),
    );
    expect(screen.queryByText("reads.fq")).not.toBeInTheDocument();
  });

  it("never selects or commits a file", async () => {
    const { user, onSelect } = renderPicker();
    await findOption("Home", "Alpha");
    await user.click(screen.getByRole("button", { name: "Show files" }));

    const file = await findOption("Home", /reads\.fq/);
    await user.click(file);
    await user.dblClick(file);

    expect(file).toHaveAttribute("aria-selected", "false");
    expect(file).not.toHaveAttribute("tabindex");
    expect(selectButton()).toHaveAccessibleName("Select “Home”");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("starts the first column wider than the folder columns", async () => {
    const { user } = renderPicker();
    await user.click(await findOption("Home", "Experiments"));
    await user.click(await findOption("Experiments", "Run1"));
    await screen.findByText("This folder is empty.");

    expect(
      screen
        .getAllByRole("separator", { name: /column$/ })
        .map((handle) => handle.getAttribute("aria-valuenow")),
    ).toEqual(["240", "180", "180"]);
  });

  it("resizes a column from the keyboard and resets it on double click", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");
    const handle = screen.getByRole("separator", {
      name: "Resize Home column",
    });

    handle.focus();
    await user.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "256");

    await user.dblClick(handle);
    expect(handle).toHaveAttribute("aria-valuenow", "240");
  });

  it("resets a folder column to the folder width, not the first column's", async () => {
    const { user } = renderPicker();
    await user.click(await findOption("Home", "Experiments"));
    const handle = await screen.findByRole("separator", {
      name: "Resize Experiments column",
    });

    handle.focus();
    await user.keyboard("{ArrowLeft}");
    expect(handle).toHaveAttribute("aria-valuenow", "164");

    await user.dblClick(handle);
    expect(handle).toHaveAttribute("aria-valuenow", "180");
  });

  it("keeps a column's width when the folders in it change", async () => {
    const { user } = renderPicker();
    await user.click(await findOption("Home", "Experiments"));
    const handle = await screen.findByRole("separator", {
      name: "Resize Experiments column",
    });
    handle.focus();
    await user.keyboard("{ArrowRight}");

    await user.click(await findOption("Home", "Alpha"));

    // Widths belong to the column position, not to the folder it lists.
    expect(
      screen.getByRole("separator", { name: "Resize Alpha column" }),
    ).toHaveAttribute("aria-valuenow", "196");
  });

  it("resizes the info pane from its left edge", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");
    const handle = screen.getByRole("separator", { name: "Resize info pane" });
    expect(handle).toHaveAttribute("aria-valuenow", "320");

    handle.focus();
    // The handle is on the pane's left edge, so → narrows it.
    await user.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "304");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(handle).toHaveAttribute("aria-valuenow", "336");

    await user.dblClick(handle);
    expect(handle).toHaveAttribute("aria-valuenow", "320");
  });
});
