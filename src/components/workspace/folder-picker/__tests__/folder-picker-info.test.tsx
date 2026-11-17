import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import {
  FilePickerInfo,
  FolderPickerInfo,
} from "@/components/workspace/folder-picker/folder-picker-preview";
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

describe("FolderPickerInfo with no folder selected, picking files", () => {
  const fileTarget: Props["target"] = { kind: "object", types: ["contigs"] };

  it("says Shared includes read-only workspaces, which files can be picked from", () => {
    renderInfo({ target: fileTarget, place: "shared", path: null });

    expect(
      screen.getByText(
        "Workspaces other people shared with you, including read-only ones.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/where you can write/)).not.toBeInTheDocument();
  });

  it("says files can be picked from Public, not that it is for saving elsewhere", () => {
    renderInfo({ target: fileTarget, place: "public", path: null });

    expect(
      screen.getByText("Public workspaces you can browse and pick files from."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/save elsewhere/)).not.toBeInTheDocument();
  });

  it.each<[PickerView, string]>([
    ["home", "Your home folder."],
    ["favorites", "Folders you starred in the workspace browser."],
    ["recent", "Folders you used recently, newest first."],
  ])("keeps the folder-mode hint for %s", (place, hint) => {
    renderInfo({ target: fileTarget, place, path: null });

    expect(screen.getByText(hint)).toBeInTheDocument();
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

  it("says the contents are unknown when the folder's listing failed", () => {
    renderInfo({
      contents: {
        items: [],
        isLoading: false,
        error: new Error("Internal server error"),
      },
    });

    expect(detail("Contains")).toBe("Couldn't check");
  });

  it("claims no write access when a listing it relies on failed", () => {
    renderInfo({
      contents: {
        items: [],
        isLoading: false,
        error: new Error("Internal server error"),
      },
      listingError: new Error("Internal server error"),
      commit: { canCommit: true, reason: null },
    });

    expect(
      screen.getByText(
        "Couldn't check this folder's contents or write access: Internal server error",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You can write here/)).not.toBeInTheDocument();
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

  it("renders no buttons of its own: the actions come in through the slot", () => {
    renderInfo();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

/** A stand-in for the dialog's `FolderPickerActions`, which has its own tests. */
const actionsSlot = (
  <div role="group" aria-label="Folder actions">
    <button type="button">Act</button>
  </div>
);

function slot() {
  return screen.getByRole("group", { name: "Folder actions" });
}

describe("the Info pane's actions slot", () => {
  const file: WorkspaceItem = {
    id: "draft",
    name: "draft.fasta",
    path: `${home}/x/draft.fasta`,
    type: "contigs",
    size: 4,
  };

  function renderFileInfo(actions?: Props["actions"]) {
    render(
      <FilePickerInfo
        item={file}
        place="home"
        commit={{ canCommit: true, reason: null }}
        actions={actions}
      />,
    );
  }

  it("is the last child of the scrolling body, after the details and the commit note", () => {
    renderInfo({ actions: actionsSlot });

    const body = slot().parentElement;
    expect(body).toHaveClass("overflow-y-auto");
    expect(body?.lastElementChild).toBe(slot());
    const details = screen
      .getByText("Where", { selector: "dt" })
      .closest("dl") as HTMLElement;
    expect(details.compareDocumentPosition(slot())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(slot().previousElementSibling).toHaveTextContent(
      "You can write here, so results can be saved in this folder.",
    );
  });

  it("follows the failed-listing note too, whatever the note says", () => {
    renderInfo({
      actions: actionsSlot,
      listingError: new Error("Internal server error"),
    });

    expect(slot().parentElement?.lastElementChild).toBe(slot());
    expect(slot().previousElementSibling).toHaveTextContent(
      "Couldn't check this folder's contents or write access: Internal server error",
    );
  });

  it("is not hidden on phones, unlike the name block and the details", () => {
    renderInfo({ actions: actionsSlot });

    const nameBlock = screen.getByText(`${home}/x`, { selector: "p" })
      .parentElement as HTMLElement;
    const details = screen
      .getByText("Where", { selector: "dt" })
      .closest("dl") as HTMLElement;
    expect(nameBlock).toHaveClass("hidden");
    expect(details).toHaveClass("hidden");
    expect(slot()).not.toHaveClass("hidden");
    expect(slot().parentElement).not.toHaveClass("hidden");
  });

  it("follows the centred hint block while no folder is open", () => {
    renderInfo({ place: "recent", path: null, actions: actionsSlot });

    const hint = screen.getByText("Folders you used recently, newest first.");
    const hintBlock = hint.parentElement as HTMLElement;
    expect(hintBlock).toHaveTextContent("Recently Used");
    expect(hintBlock).not.toContainElement(slot());
    expect(hintBlock).toHaveClass("flex-1", "justify-center");
    expect(slot().previousElementSibling).toBe(hintBlock);
    expect(slot().parentElement?.lastElementChild).toBe(slot());
    expect(slot().parentElement).toHaveClass("overflow-y-auto");
    expect(slot()).not.toHaveClass("hidden");
  });

  it("is the last child of a selected file's body, after its details and commit note", () => {
    renderFileInfo(actionsSlot);

    const body = slot().parentElement;
    expect(body).toHaveClass("overflow-y-auto");
    expect(body?.lastElementChild).toBe(slot());
    const details = screen
      .getByText("Type", { selector: "dt" })
      .closest("dl") as HTMLElement;
    expect(details.compareDocumentPosition(slot())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(slot().previousElementSibling).toHaveTextContent(
      "You can use this file here.",
    );
  });

  it("is absent from every state when it is not passed", () => {
    const { unmount } = render(
      <FolderPickerInfo
        place="home"
        path={null}
        homePath={home}
        item={null}
        contents={{ items: [], isLoading: false }}
        commit={{ canCommit: true, reason: null }}
      />,
    );
    expect(
      screen.queryByRole("group", { name: "Folder actions" }),
    ).not.toBeInTheDocument();
    unmount();

    const folder = render(
      <FolderPickerInfo
        place="home"
        path={`${home}/x`}
        homePath={home}
        item={null}
        contents={{ items: [], isLoading: false }}
        commit={{ canCommit: true, reason: null }}
      />,
    );
    expect(
      screen.queryByRole("group", { name: "Folder actions" }),
    ).not.toBeInTheDocument();
    folder.unmount();

    renderFileInfo();
    expect(
      screen.queryByRole("group", { name: "Folder actions" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
