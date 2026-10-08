import { screen, waitFor, within } from "@testing-library/react";
import {
  breadcrumb,
  columnLabels,
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

/** Rows in the Tab order (each resize handle is a Tab stop of its own). */
function tabStops() {
  return within(screen.getByRole("group", { name: "Folder columns" }))
    .getAllByRole("option")
    .filter((row) => row.getAttribute("tabindex") === "0");
}

function place(name: string) {
  return within(screen.getByRole("navigation", { name: "Places" })).getByRole(
    "button",
    { name },
  );
}

async function expectFocus(column: string, option: string | RegExp) {
  const row = await findOption(column, option);
  await waitFor(() => {
    expect(row).toHaveFocus();
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("WorkspaceFolderPickerDialog focus", () => {
  it("focuses the first folder when it opens on Home", async () => {
    renderPicker();

    await expectFocus("Home", "Alpha");
  });

  it("focuses the current value when it opens", async () => {
    renderPicker({ initialPath: `${home}/Experiments/Run1` });

    await expectFocus("Experiments", "Run1");
  });

  it("keeps exactly one row in the Tab order, on the selection", async () => {
    const { user } = renderPicker();
    await expectFocus("Home", "Alpha");
    expect(tabStops()).toHaveLength(1);

    await user.click(await findOption("Home", "Experiments"));
    await findOption("Experiments", "Run1");
    expect(tabStops()).toHaveLength(1);
    expect(await findOption("Home", "Experiments")).toHaveAttribute(
      "tabindex",
      "0",
    );

    await user.keyboard("{ArrowRight}");
    await expectFocus("Experiments", "Run1");
    expect(tabStops()).toHaveLength(1);
    expect(await findOption("Experiments", "Run1")).toHaveAttribute(
      "tabindex",
      "0",
    );
  });

  it("leaves focus on the sidebar when a place is chosen", async () => {
    const { user } = renderPicker();
    await expectFocus("Home", "Alpha");

    await user.click(place("My Workspaces"));
    await findOption("My Workspaces", "projects");

    expect(place("My Workspaces")).toHaveFocus();
  });

  it("moves focus to the folder a crumb jumps to", async () => {
    const { user } = renderPicker({ initialPath: `${home}/Experiments/Run1` });
    await expectFocus("Experiments", "Run1");

    await user.click(
      within(breadcrumb()).getByRole("button", { name: "Experiments" }),
    );
    await expectFocus("Home", "Experiments");

    await user.click(within(breadcrumb()).getByRole("button", { name: "Home" }));
    await expectFocus("Home", "Alpha");
  });
});

describe("WorkspaceFolderPickerDialog arrow keys", () => {
  it("walks the columns with the arrow keys and commits with Enter", async () => {
    const { user, onSelect } = renderPicker();

    await user.click(await findOption("Home", "Alpha"));
    await user.keyboard("{ArrowDown}");
    expect(selectButton()).toHaveAccessibleName("Select “Experiments”");
    await expectFocus("Home", "Experiments");

    await findOption("Experiments", "Run1");
    await user.keyboard("{ArrowRight}");
    await waitFor(() => {
      expect(selectButton()).toHaveAccessibleName("Select “Run1”");
    });
    await expectFocus("Experiments", "Run1");

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => {
      expect(selectButton()).toHaveAccessibleName("Select “Experiments”");
    });
    await expectFocus("Home", "Experiments");
    expect(columnLabels()).toEqual(["Home", "Experiments"]);

    await user.keyboard("{ArrowRight}{Enter}");
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(`${home}/Experiments/Run1`);
    });
  });

  it("selects the focused row on the first press instead of skipping it", async () => {
    const { user } = renderPicker();
    await expectFocus("Home", "Alpha");

    await user.keyboard("{ArrowDown}");

    expect(selectButton()).toHaveAccessibleName("Select “Alpha”");
  });

  it("stops at the first and last folder, and jumps with Home and End", async () => {
    const { user } = renderPicker();
    await user.click(await findOption("Home", "Alpha"));

    await user.keyboard("{ArrowUp}");
    expect(selectButton()).toHaveAccessibleName("Select “Alpha”");

    await user.keyboard("{End}");
    expect(selectButton()).toHaveAccessibleName("Select “Experiments”");
    await expectFocus("Home", "Experiments");

    await user.keyboard("{ArrowDown}");
    expect(selectButton()).toHaveAccessibleName("Select “Experiments”");

    await user.keyboard("{Home}");
    expect(selectButton()).toHaveAccessibleName("Select “Alpha”");
    await expectFocus("Home", "Alpha");
  });

  it("selects the focused row with Space", async () => {
    const { user } = renderPicker();
    await expectFocus("Home", "Alpha");

    await user.keyboard(" ");

    expect(selectButton()).toHaveAccessibleName("Select “Alpha”");
  });

  it("stays put on → in a folder without subfolders", async () => {
    const { user } = renderPicker();
    await user.click(await findOption("Home", "Alpha"));
    await screen.findByText("This folder is empty.");

    await user.keyboard("{ArrowRight}");

    expect(selectButton()).toHaveAccessibleName("Select “Alpha”");
    expect(columnLabels()).toEqual(["Home", "Alpha"]);
    await expectFocus("Home", "Alpha");
  });

  it("stays put on ← in the first column", async () => {
    const { user } = renderPicker();
    await user.click(await findOption("Home", "Alpha"));

    await user.keyboard("{ArrowLeft}");

    expect(selectButton()).toHaveAccessibleName("Select “Alpha”");
    await expectFocus("Home", "Alpha");
  });

  it("returns to the folder already open further right instead of reselecting", async () => {
    const { user } = renderPicker({ initialPath: `${home}/Experiments/Run1` });
    await expectFocus("Experiments", "Run1");
    (await findOption("Home", "Experiments")).focus();

    await user.keyboard("{ArrowRight}");

    await expectFocus("Experiments", "Run1");
    expect(selectButton()).toHaveAccessibleName("Select “Run1”");
    expect(columnLabels()).toEqual(["Home", "Experiments", "Run1"]);
  });

  it("selects a folder in another column on → instead of opening its child", async () => {
    const { user } = renderPicker({ initialPath: `${home}/Experiments/Run1` });
    await expectFocus("Experiments", "Run1");
    (await findOption("Home", "Alpha")).focus();

    await user.keyboard("{ArrowRight}");

    expect(selectButton()).toHaveAccessibleName("Select “Alpha”");
    expect(columnLabels()).toEqual(["Home", "Alpha"]);
  });

  it("enters the first folder on →, past items it cannot open", async () => {
    const repository = makePickerRepository({
      directories: {
        [home]: [{ name: "Batch", type: "folder" }],
        [`${home}/Batch`]: [
          // Folder-like, so it sorts with the folders, but not navigable.
          { name: "assembly-job", type: "job_result" },
          { name: "outputs", type: "folder" },
        ],
      },
    });
    const { user } = renderPicker({}, repository);
    await user.click(await findOption("Home", "Batch"));
    await user.click(screen.getByRole("button", { name: "Show files" }));
    expect(
      within(await screen.findByRole("listbox", { name: "Batch" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["assembly-job", "outputs"]);

    (await findOption("Home", "Batch")).focus();
    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      expect(selectButton()).toHaveAccessibleName("Select “outputs”");
    });
    await expectFocus("Batch", "outputs");
  });

  it("does nothing on Enter in a folder the user cannot write to", async () => {
    const { user, onSelect } = renderPicker();
    await expectFocus("Home", "Alpha");
    await user.click(place("Public Workspaces"));
    await user.click(await findOption("Public Workspaces", /public-ws/));

    await user.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("resizes with the arrow keys on a handle without moving the selection", async () => {
    const { user } = renderPicker();
    await user.click(await findOption("Home", "Experiments"));
    const handle = screen.getByRole("separator", { name: "Resize Home column" });

    handle.focus();
    await user.keyboard("{ArrowRight}{ArrowLeft}{ArrowLeft}");

    expect(handle).toHaveAttribute("aria-valuenow", "224");
    expect(selectButton()).toHaveAccessibleName("Select “Experiments”");
    expect(columnLabels()).toEqual(["Home", "Experiments"]);
  });
});
