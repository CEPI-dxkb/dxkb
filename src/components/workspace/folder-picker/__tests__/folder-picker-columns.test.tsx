import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  findOption,
  makePickerRepository,
  pickerHome as home,
  pickerUser,
  renderPicker,
  rootItem,
  stubPickerBrowserApis,
} from "./fixtures/picker-harness";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ user: pickerUser }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

stubPickerBrowserApis();

/** The column whose header (and resize handle) is labelled `label`. */
function column(label: string) {
  const handle = screen.getByRole("separator", {
    name: `Resize ${label} column`,
  });
  const element = handle.closest<HTMLElement>("[data-picker-column]");
  if (!element) throw new Error(`No column ${label}`);
  return element;
}

/** The folder count in a column's header, or null while it shows none. */
function headerCount(label: string) {
  return (
    within(column(label)).queryByText(/^\d+$/, { selector: "span" })
      ?.textContent ?? null
  );
}

function openPlace(name: string) {
  return within(screen.getByRole("navigation", { name: "Places" })).getByRole(
    "button",
    { name },
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("WorkspaceFolderPickerDialog column states", () => {
  it("shows a loading state until the folder is listed", async () => {
    const repository = makePickerRepository();
    const gate = repository.holdListing(home);
    renderPicker({}, repository);

    expect(
      await within(column("Home")).findByRole("status"),
    ).toHaveTextContent("Loading");
    expect(headerCount("Home")).toBeNull();

    gate.release();

    expect(await findOption("Home", "Alpha")).toBeInTheDocument();
    expect(within(column("Home")).queryByRole("status")).toBeNull();
    expect(headerCount("Home")).toBe("2");
  });

  it("keeps the backend's message when a folder cannot be listed", async () => {
    const repository = makePickerRepository();
    repository.failListing(
      `${home}/Experiments`,
      new Error("Permission denied: /alice@bvbrc/home/Experiments"),
    );
    const { user } = renderPicker({}, repository);

    await user.click(await findOption("Home", "Experiments"));

    const failed = column("Experiments");
    expect(
      await within(failed).findByText("Couldn't load this folder."),
    ).toBeInTheDocument();
    expect(
      within(failed).getByText(
        "Permission denied: /alice@bvbrc/home/Experiments",
      ),
    ).toBeInTheDocument();
    expect(headerCount("Experiments")).toBeNull();
  });

  it("explains an empty folder", async () => {
    const { user } = renderPicker();

    await user.click(await findOption("Home", "Alpha"));

    expect(
      await within(column("Alpha")).findByText("This folder is empty."),
    ).toBeInTheDocument();
    expect(headerCount("Alpha")).toBe("0");
  });

  it("offers to show the files of a folder that only holds files", async () => {
    const repository = makePickerRepository({
      directories: {
        [home]: [{ name: "Docs", type: "folder" }],
        [`${home}/Docs`]: [
          { name: "a.txt", type: "txt" },
          { name: "b.csv", type: "csv" },
          // Hidden items never show, so they are not offered either.
          { name: ".notes", type: "txt" },
        ],
      },
    });
    const { user } = renderPicker({}, repository);
    await user.click(await findOption("Home", "Docs"));
    const docs = column("Docs");
    expect(await within(docs).findByText("No folders here.")).toBeVisible();

    await user.click(within(docs).getByRole("button", { name: "Show 2 files" }));

    expect(
      screen.getByRole("button", { name: "Hide files", pressed: true }),
    ).toBeInTheDocument();
    expect(
      within(await screen.findByRole("listbox", { name: "Docs" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["a.txt", "b.csv"]);
  });

  it("names a single hidden file in the singular", async () => {
    const repository = makePickerRepository({
      directories: {
        [home]: [{ name: "Docs", type: "folder" }],
        [`${home}/Docs`]: [{ name: "a.txt", type: "txt" }],
      },
    });
    const { user } = renderPicker({}, repository);

    await user.click(await findOption("Home", "Docs"));

    expect(
      await within(column("Docs")).findByRole("button", {
        name: "Show 1 file",
      }),
    ).toBeInTheDocument();
  });

  it("does not offer files a folder only hides", async () => {
    const repository = makePickerRepository({
      directories: {
        [home]: [{ name: "Docs", type: "folder" }],
        [`${home}/Docs`]: [{ name: ".notes", type: "txt" }],
      },
    });
    const { user } = renderPicker({}, repository);

    await user.click(await findOption("Home", "Docs"));

    expect(
      await within(column("Docs")).findByText("This folder is empty."),
    ).toBeInTheDocument();
    expect(
      within(column("Docs")).queryByRole("button", { name: /^Show/ }),
    ).toBeNull();
  });

  it("counts only folders in the column header", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");
    expect(headerCount("Home")).toBe("2");

    await user.click(screen.getByRole("button", { name: "Show files" }));
    await findOption("Home", /reads\.fq/);

    expect(headerCount("Home")).toBe("2");
  });

  it("marks folders the user can only read", async () => {
    const { user } = renderPicker();
    expect(await findOption("Home", "Alpha")).not.toHaveTextContent(
      "(read-only)",
    );

    await user.click(openPlace("Public Workspaces"));
    await user.click(await findOption("Public Workspaces", /public-ws/));

    expect(await findOption("public-ws", /data/)).toHaveTextContent(
      "(read-only)",
    );
    expect(await findOption("Public Workspaces", /public-ws/)).toHaveTextContent(
      "carol",
    );
  });

  it("shows owners only in the first column of Shared and Public", async () => {
    const { user } = renderPicker();
    await user.click(openPlace("Shared Workspaces"));

    expect(await findOption("Shared Workspaces", /shared-ws/)).toHaveTextContent(
      "shared-wsbob",
    );

    await user.click(openPlace("Home"));
    expect(await findOption("Home", "Alpha")).toHaveTextContent(/^Alpha$/);
  });

  it.each([
    ["Shared Workspaces", "No workspaces are shared with you."],
    ["Public Workspaces", "No public workspaces."],
    ["Recently Used", "No recently used folders."],
  ])("explains an empty %s listing", async (placeName, message) => {
    const repository = makePickerRepository();
    repository.rootItems = [rootItem(home, { user: "o", global: "n" })];
    const { user } = renderPicker({}, repository);
    await findOption("Home", "Alpha");

    await user.click(openPlace(placeName));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("explains an empty Favorites listing", async () => {
    server.use(
      http.post("*/api/services/workspace", () =>
        HttpResponse.json({
          jsonrpc: "2.0",
          id: 1,
          result: [[[["meta"], JSON.stringify({ folders: [] })]]],
        }),
      ),
    );
    const { user } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(openPlace("Favorites"));

    expect(await screen.findByText("No favorite folders yet.")).toBeVisible();
  });

  it("explains an empty My Workspaces listing", async () => {
    const repository = makePickerRepository({
      directories: { [home]: [], "/alice@bvbrc": [] },
    });
    const { user } = renderPicker({}, repository);
    await screen.findByText("This folder is empty.");

    await user.click(openPlace("My Workspaces"));

    expect(await screen.findByText("No workspaces yet.")).toBeVisible();
    await waitFor(() => {
      expect(headerCount("My Workspaces")).toBe("0");
    });
  });
});
