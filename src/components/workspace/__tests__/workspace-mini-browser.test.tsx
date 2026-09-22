import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { WorkspaceMiniBrowser } from "@/components/workspace/workspace-mini-browser";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import { createQueryClientWrapper } from "@/test-helpers/react";

// jsdom does not implement scrollIntoView; the focus effect calls it directly.
const scrollIntoViewMock = vi.fn();
Element.prototype.scrollIntoView = scrollIntoViewMock;

// jsdom 30 does provide CSS.escape (used by the focus-scroll effect's attribute
// selector). Guard it rather than polyfilling blindly, so a future jsdom
// downgrade fails loudly here instead of silently skipping the scroll path.
if (typeof CSS === "undefined" || typeof CSS.escape !== "function") {
  throw new Error(
    "CSS.escape is unavailable in this jsdom build; add a polyfill before running these tests",
  );
}

// Controlled requestAnimationFrame: callbacks queue until flushAnimationFrames()
// so the focus-scroll effect can be observed deterministically.
const pendingFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 0;

vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
  nextFrameId += 1;
  pendingFrames.set(nextFrameId, callback);
  return nextFrameId;
});
vi.stubGlobal("cancelAnimationFrame", (id: number) => {
  pendingFrames.delete(id);
});

function flushAnimationFrames() {
  const queued = [...pendingFrames.values()];
  pendingFrames.clear();
  for (const callback of queued) callback(0);
}

const homePath = "/alice@bvbrc/home";
const alphaPath = `${homePath}/alpha`;
const betaPath = `${homePath}/beta`;
const gammaPath = `${homePath}/gamma`;

function makeRepository() {
  return new InMemoryWorkspaceRepository({
    directories: {
      "/alice@bvbrc": [{ name: "home", type: "folder" }],
      [homePath]: [
        { name: "gamma", type: "folder" },
        { name: "alpha", type: "folder" },
        { name: "beta", type: "folder" },
        { name: "notes.txt", type: "txt", size: 12 },
      ],
      [alphaPath]: [{ name: "alpha-child", type: "folder" }],
    },
  });
}

function makeWrapper(repository: InMemoryWorkspaceRepository) {
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

interface RenderOptions {
  initialPath?: string;
  selectedPath?: string | null;
  repository?: InMemoryWorkspaceRepository;
}

async function renderMiniBrowser({
  initialPath = homePath,
  selectedPath = null,
  repository = makeRepository(),
}: RenderOptions = {}) {
  const onSelectPath = vi.fn();
  render(
    <WorkspaceMiniBrowser
      initialPath={initialPath}
      selectedPath={selectedPath}
      onSelectPath={onSelectPath}
    />,
    { wrapper: makeWrapper(repository) },
  );

  const region = await screen.findByRole("region", {
    name: "Workspace destination browser",
  });
  return { onSelectPath, region, repository };
}

function listDirectoryPaths(repository: InMemoryWorkspaceRepository) {
  return repository.calls
    .filter((call) => call.method === "listDirectory")
    .map((call) => call.input.path);
}

const arrowDown = (region: HTMLElement) => {
  fireEvent.keyDown(region, { key: "ArrowDown" });
};
const arrowUp = (region: HTMLElement) => {
  fireEvent.keyDown(region, { key: "ArrowUp" });
};
const shiftArrowDown = (region: HTMLElement) => {
  fireEvent.keyDown(region, { key: "ArrowDown", shiftKey: true });
};
const shiftArrowUp = (region: HTMLElement) => {
  fireEvent.keyDown(region, { key: "ArrowUp", shiftKey: true });
};
const enter = (region: HTMLElement) => {
  fireEvent.keyDown(region, { key: "Enter" });
};

describe("WorkspaceMiniBrowser keyboard navigation", () => {
  it("moves down through folders in sorted order, starting from the parent row", async () => {
    const { onSelectPath, region } = await renderMiniBrowser();
    await screen.findByRole("row", { name: /alpha/ });

    // Folders are sorted alphabetically and notes.txt is filtered out by the
    // default folders-only mode, so the targets are parent, alpha, beta, gamma.
    arrowDown(region);
    expect(onSelectPath).toHaveBeenLastCalledWith(alphaPath);
    arrowDown(region);
    expect(onSelectPath).toHaveBeenLastCalledWith(betaPath);
    arrowDown(region);
    expect(onSelectPath).toHaveBeenLastCalledWith(gammaPath);
    expect(onSelectPath.mock.calls).toEqual([
      [alphaPath],
      [betaPath],
      [gammaPath],
    ]);
  });

  it("moves back up and stops on the parent row without selecting it", async () => {
    const { onSelectPath, region } = await renderMiniBrowser();
    await screen.findByRole("row", { name: /alpha/ });

    arrowDown(region);
    arrowDown(region);
    expect(onSelectPath).toHaveBeenLastCalledWith(betaPath);

    arrowUp(region);
    expect(onSelectPath).toHaveBeenLastCalledWith(alphaPath);

    onSelectPath.mockClear();
    arrowUp(region);
    // Landing on the synthetic "parent" target focuses it but selects nothing.
    expect(onSelectPath).not.toHaveBeenCalled();
  });

  it("jumps to the last target on Shift+ArrowDown and the first on Shift+ArrowUp", async () => {
    const { onSelectPath, region, repository } = await renderMiniBrowser();
    await screen.findByRole("row", { name: /alpha/ });

    shiftArrowDown(region);
    expect(onSelectPath).toHaveBeenLastCalledWith(gammaPath);

    onSelectPath.mockClear();
    shiftArrowUp(region);
    // First target is the parent row, which is focused but not selected.
    expect(onSelectPath).not.toHaveBeenCalled();

    // Shift+ArrowUp focused the parent row, so Enter navigates to the parent.
    enter(region);
    expect(onSelectPath).toHaveBeenLastCalledWith("/alice@bvbrc");
    await waitFor(() => {
      expect(listDirectoryPaths(repository)).toContain("/alice@bvbrc");
    });
  });

  it("clamps at the last target", async () => {
    const { onSelectPath, region } = await renderMiniBrowser();
    await screen.findByRole("row", { name: /alpha/ });

    shiftArrowDown(region);
    expect(onSelectPath).toHaveBeenLastCalledWith(gammaPath);

    onSelectPath.mockClear();
    arrowDown(region);
    arrowDown(region);
    expect(onSelectPath.mock.calls).toEqual([[gammaPath], [gammaPath]]);
  });

  it("clamps at the first target and keeps the parent row focused", async () => {
    const { onSelectPath, region, repository } = await renderMiniBrowser();
    await screen.findByRole("row", { name: /alpha/ });

    shiftArrowUp(region);
    arrowUp(region);
    arrowUp(region);
    expect(onSelectPath).not.toHaveBeenCalled();

    enter(region);
    expect(onSelectPath).toHaveBeenCalledWith("/alice@bvbrc");
    await waitFor(() => {
      expect(listDirectoryPaths(repository)).toContain("/alice@bvbrc");
    });
  });

  it("starts from the first folder when there is no parent row", async () => {
    const repository = new InMemoryWorkspaceRepository({
      directories: {
        "/": [
          { name: "zeta", type: "folder" },
          { name: "alpha", type: "folder" },
        ],
      },
    });
    const { onSelectPath, region } = await renderMiniBrowser({
      initialPath: "/",
      repository,
    });
    await screen.findByRole("row", { name: /alpha/ });

    // "/" has no path segments, so showParentRow is false and nothing is
    // focused initially: both arrow directions land on the first folder.
    arrowUp(region);
    expect(onSelectPath).toHaveBeenLastCalledWith("/alpha");

    onSelectPath.mockClear();
    arrowDown(region);
    expect(onSelectPath).toHaveBeenLastCalledWith("/zeta");
  });

  it("seeds the starting index from an external selectedPath", async () => {
    const { onSelectPath, region } = await renderMiniBrowser({
      selectedPath: betaPath,
    });
    await screen.findByRole("row", { name: /alpha/ });

    // focusedRow is null, so selectedPath (beta) decides where movement starts.
    arrowDown(region);
    expect(onSelectPath).toHaveBeenLastCalledWith(gammaPath);
  });

  it("ignores keys other than the arrows and Enter", async () => {
    const { onSelectPath, region, repository } = await renderMiniBrowser();
    await screen.findByRole("row", { name: /alpha/ });

    fireEvent.keyDown(region, { key: "a" });
    fireEvent.keyDown(region, { key: "Tab" });
    fireEvent.keyDown(region, { key: " " });
    expect(onSelectPath).not.toHaveBeenCalled();
    expect(listDirectoryPaths(repository)).toEqual([homePath]);
  });
});

describe("WorkspaceMiniBrowser selecting versus navigating", () => {
  it("selects without navigating on arrow movement", async () => {
    const { onSelectPath, region, repository } = await renderMiniBrowser();
    await screen.findByRole("row", { name: /alpha/ });

    arrowDown(region);
    arrowDown(region);

    expect(onSelectPath).toHaveBeenLastCalledWith(betaPath);
    // Arrow movement must not change currentPath, so no new listing is fetched.
    expect(listDirectoryPaths(repository)).toEqual([homePath]);
    expect(screen.getByRole("row", { name: /gamma/ })).toBeInTheDocument();
  });

  it("navigates into the focused folder on Enter", async () => {
    const { onSelectPath, region, repository } = await renderMiniBrowser();
    await screen.findByRole("row", { name: /alpha/ });

    arrowDown(region);
    onSelectPath.mockClear();
    enter(region);

    expect(onSelectPath).toHaveBeenCalledWith(alphaPath);
    await waitFor(() => {
      expect(listDirectoryPaths(repository)).toEqual([homePath, alphaPath]);
    });
    expect(
      await screen.findByRole("row", { name: /alpha-child/ }),
    ).toBeInTheDocument();
  });

  it("navigates using an external selectedPath when nothing is focused", async () => {
    const { onSelectPath, region, repository } = await renderMiniBrowser({
      selectedPath: alphaPath,
    });
    await screen.findByRole("row", { name: /alpha/ });

    enter(region);

    expect(onSelectPath).toHaveBeenCalledWith(alphaPath);
    await waitFor(() => {
      expect(listDirectoryPaths(repository)).toEqual([homePath, alphaPath]);
    });
  });

  it("does nothing on Enter when nothing is focused or selected", async () => {
    const { onSelectPath, region, repository } = await renderMiniBrowser();
    await screen.findByRole("row", { name: /alpha/ });

    enter(region);

    expect(onSelectPath).not.toHaveBeenCalled();
    expect(listDirectoryPaths(repository)).toEqual([homePath]);
  });

  it("selects on single click and navigates on double click", async () => {
    const { onSelectPath, repository } = await renderMiniBrowser();
    const alphaRow = await screen.findByRole("row", { name: /alpha/ });

    fireEvent.click(alphaRow);
    expect(onSelectPath).toHaveBeenLastCalledWith(alphaPath);
    expect(listDirectoryPaths(repository)).toEqual([homePath]);

    fireEvent.doubleClick(alphaRow);
    await waitFor(() => {
      expect(listDirectoryPaths(repository)).toEqual([homePath, alphaPath]);
    });
  });
});

describe("WorkspaceMiniBrowser focus scrolling", () => {
  it("scrolls the focused row into view on the next animation frame", async () => {
    const { region } = await renderMiniBrowser();
    await screen.findByRole("row", { name: /alpha/ });

    pendingFrames.clear();
    scrollIntoViewMock.mockClear();

    arrowDown(region);
    // The effect only schedules the scroll; nothing happens until it is flushed.
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(pendingFrames.size).toBe(1);

    flushAnimationFrames();
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: "center",
      inline: "start",
    });
    expect(scrollIntoViewMock.mock.instances[0]).toBe(
      document.querySelector(`[data-row-key="${CSS.escape(alphaPath)}"]`),
    );
  });
});
