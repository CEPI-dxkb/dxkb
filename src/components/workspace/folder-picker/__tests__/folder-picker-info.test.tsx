import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { FolderPickerInfo } from "@/components/workspace/folder-picker/folder-picker-preview";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import type { PickerView } from "@/lib/services/workspace/picker-views";

const home = "/alice@bvbrc/home";

type Props = ComponentProps<typeof FolderPickerInfo>;

function child(name: string, type: string): WorkspaceItem {
  return {
    id: name,
    name,
    path: `${home}/x/${name}`,
    type,
    size: 0,
  };
}

function renderInfo(overrides: Partial<Props> = {}) {
  const props: Props = {
    place: "home",
    path: `${home}/x`,
    homePath: home,
    item: null,
    contents: { items: [], isLoading: false },
    commit: { canCommit: true, reason: null },
    canChange: true,
    onNewFolder: vi.fn(),
    onUpload: vi.fn(),
    ...overrides,
  };
  render(<FolderPickerInfo {...props} />);
  return props;
}

function detail(term: string) {
  return screen.getByText(term, { selector: "dt" }).nextElementSibling
    ?.textContent;
}

describe("FolderPickerInfo with no folder selected", () => {
  it.each<[PickerView, string, string]>([
    ["home", "Home", "Your home folder."],
    [
      "myWorkspaces",
      "My Workspaces",
      "Pick one of your workspaces to see its folders.",
    ],
    [
      "shared",
      "Shared Workspaces",
      "Workspaces other people shared with you, where you can write.",
    ],
    [
      "public",
      "Public Workspaces",
      "Public workspaces are read-only: browse them, but save elsewhere.",
    ],
    ["favorites", "Favorites", "Folders you starred in the workspace browser."],
    ["recent", "Recently Used", "Folders you used recently, newest first."],
  ])("describes %s", (place, label, hint) => {
    renderInfo({ place, path: null });

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(hint)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("FolderPickerInfo with a folder selected", () => {
  it("names the folder and shows its full path", () => {
    renderInfo({ path: `${home}/Experiments/Run 1` });

    expect(screen.getByText("Run 1")).toBeInTheDocument();
    expect(screen.getByText(`${home}/Experiments/Run 1`)).toBeInTheDocument();
  });

  it("calls the home folder Home", () => {
    renderInfo({ path: home });

    expect(screen.getByText("Home", { selector: "p" })).toBeInTheDocument();
  });

  it("takes the owner from the folder, or else from its path", () => {
    renderInfo({
      path: "/bob@bvbrc/lab",
      place: "shared",
      item: { ...child("lab", "folder"), ownerId: "carol@bvbrc" },
    });
    expect(detail("Owner")).toBe("carol");
    expect(detail("Where")).toBe("Shared Workspaces");
  });

  it("falls back to the path's owner while the folder's row is loading", () => {
    renderInfo({ path: "/bob@bvbrc/lab", place: "shared", item: null });

    expect(detail("Owner")).toBe("bob");
    expect(screen.queryByText("Created")).not.toBeInTheDocument();
  });

  it.each([
    [[], "Nothing yet"],
    [[child("a", "folder")], "1 folder, 0 files"],
    [[child("a.txt", "txt")], "0 folders, 1 file"],
    [
      [child("a", "folder"), child("b", "folder"), child("c.txt", "txt")],
      "2 folders, 1 file",
    ],
    [
      [child("a", "folder"), child(".hidden", "folder"), child(".x", "txt")],
      "1 folder, 0 files",
    ],
    [[child(".hidden", "folder")], "Nothing yet"],
  ])("counts %j as %s", (items, summary) => {
    renderInfo({ contents: { items, isLoading: false } });

    expect(detail("Contains")).toBe(summary);
  });

  it("shows an ellipsis while the contents load", () => {
    renderInfo({ contents: { items: [], isLoading: true } });

    expect(detail("Contains")).toBe("…");
  });

  it("confirms a folder the results can be saved in", () => {
    renderInfo({ commit: { canCommit: true, reason: null } });

    expect(
      screen.getByText(
        "You can write here, so results can be saved in this folder.",
      ),
    ).toBeInTheDocument();
  });

  it("gives the reason a folder cannot be chosen", () => {
    renderInfo({
      commit: {
        canCommit: false,
        reason: "You don't have write access to this folder.",
      },
    });

    expect(
      screen.getByText("You don't have write access to this folder."),
    ).toBeInTheDocument();
  });

  it("offers New folder and Upload where the user can write", async () => {
    const user = userEvent.setup();
    const { onNewFolder, onUpload } = renderInfo({ canChange: true });

    await user.click(screen.getByRole("button", { name: "New folder here" }));
    await user.click(screen.getByRole("button", { name: "Upload here" }));

    expect(onNewFolder).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it("disables New folder and Upload where the user cannot write", () => {
    renderInfo({ canChange: false });

    expect(
      screen.getByRole("button", { name: "New folder here" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Upload here" })).toBeDisabled();
  });
});
