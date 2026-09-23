import { render, screen, waitFor } from "@testing-library/react";
import type { Archaeopteryx, ArchaeopteryxConfig } from "archaeopteryx";

import {
  loadArchaeopteryx,
  type ArchaeopteryxNode,
} from "@/lib/phylogeny/archaeopteryx";

import { ArchaeopteryxPhylogeny } from "../archaeopteryx-phylogeny";

vi.mock("@/lib/phylogeny/archaeopteryx", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/phylogeny/archaeopteryx")>()),
  loadArchaeopteryx: vi.fn(),
}));

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];

  observe = vi.fn();
  disconnect = vi.fn();

  constructor() {
    ResizeObserverStub.instances.push(this);
  }
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

let narrowScreen = false;
vi.stubGlobal(
  "matchMedia",
  vi.fn((query: string) => ({ matches: narrowScreen, media: query })),
);

interface FakeViewerOptions {
  ready?: Promise<void>;
  /** Like a big tree: nothing is drawn until the next frame. */
  drawWhen?: Promise<void>;
  launchError?: Error;
  selectedNodes?: ArchaeopteryxNode[];
}

// Stands in for Archaeopteryx: draws a panel whose theme switch behaves like
// the real one, and records what the component launched it with.
function createFakeArchaeopteryx({
  ready,
  drawWhen,
  launchError,
  selectedNodes = [],
}: FakeViewerOptions = {}) {
  const destroy = vi.fn();
  const toggleTheme = vi.fn();
  const configs: ArchaeopteryxConfig[] = [];
  const tree = { children: [] };
  const renderer = {
    parsePhyloXML: vi.fn(() => tree),
    getSelectedNodes: vi.fn(() => selectedNodes),
    launch: vi.fn(
      (container: Element, _tree: unknown, config: ArchaeopteryxConfig) => {
        configs.push(config);
        if (launchError) throw launchError;
        // Like the real viewer, the theme is read at launch, not at draw time.
        const theme = localStorage.getItem("aptx-panel-theme") ?? "light";
        const draw = () => {
          const panel = document.createElement("div");
          panel.className = `aptx-panel aptx-${theme}`;
          const toggle = document.createElement("button");
          toggle.className = "aptx-theme-btn";
          toggle.addEventListener("click", () => {
            toggleTheme();
            const dark = panel.classList.contains("aptx-dark");
            panel.classList.replace(
              dark ? "aptx-dark" : "aptx-light",
              dark ? "aptx-light" : "aptx-dark",
            );
          });
          panel.append(toggle);
          container.append(panel);
        };
        if (!drawWhen) draw();
        return {
          ready: ready ?? drawWhen?.then(draw) ?? Promise.resolve(),
          destroy,
          getSelectedNodes: renderer.getSelectedNodes,
        };
      },
    ),
  };
  vi.mocked(loadArchaeopteryx).mockResolvedValue(
    renderer as unknown as Archaeopteryx,
  );
  return { renderer, configs, destroy, toggleTheme, tree };
}

describe("ArchaeopteryxPhylogeny", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "dxkb-light";
    localStorage.removeItem("aptx-panel-theme");
    narrowScreen = false;
    ResizeObserverStub.instances = [];
  });

  it("launches a viral tree into its host with the Host visualization", async () => {
    const { renderer, tree } = createFakeArchaeopteryx();

    const { container } = render(
      <ArchaeopteryxPhylogeny xml="<phyloxml />" title="Test tree" />,
    );
    const host = screen.getByRole("group", {
      name: "Interactive phylogenetic tree for Test tree",
    });

    await waitFor(() => {
      expect(container.querySelector(".absolute.inset-0")).toBeNull();
    });
    expect(renderer.parsePhyloXML).toHaveBeenCalledWith("<phyloxml />");
    expect(renderer.launch).toHaveBeenCalledWith(
      host,
      tree,
      expect.objectContaining({
        collapseControlPanel: false,
        enableManualNodeSelection: false,
        initialVisualization: "Host",
      }),
    );
    expect(ResizeObserverStub.instances[0]?.observe).toHaveBeenCalledWith(host);
  });

  it("lets a selectable tree pick leaves and collapses the panel on narrow screens", async () => {
    narrowScreen = true;
    const { renderer, configs } = createFakeArchaeopteryx();

    render(
      <ArchaeopteryxPhylogeny
        xml="<phyloxml />"
        title="Test tree"
        selectable
      />,
    );

    await waitFor(() => {
      expect(renderer.launch).toHaveBeenCalledOnce();
    });
    expect(configs[0]).toMatchObject({
      collapseControlPanel: true,
      enableManualNodeSelection: true,
    });
    expect(configs[0]).not.toHaveProperty("initialVisualization");
  });

  it("reports the selected leaf and clears the selection for internal nodes", async () => {
    const selectedNodes: ArchaeopteryxNode[] = [];
    createFakeArchaeopteryx({ selectedNodes });
    const onSelect = vi.fn();

    const { container } = render(
      <ArchaeopteryxPhylogeny
        xml="<phyloxml />"
        title="Test tree"
        selectable
        onSelect={onSelect}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector(".aptx-panel")).not.toBeNull();
    });

    const leaf = { name: "Leaf A" };
    selectedNodes.push(leaf);
    document.dispatchEvent(new Event("selected_nodes_changed_event"));
    expect(onSelect).toHaveBeenLastCalledWith(leaf);

    selectedNodes.push({ name: "Clade", children: [{ name: "Leaf B" }] });
    document.dispatchEvent(new Event("selected_nodes_changed_event"));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("opens in the site theme and follows it without relaunching", async () => {
    document.documentElement.dataset.theme = "dxkb-dark";
    const { renderer, destroy, toggleTheme } = createFakeArchaeopteryx();

    const { container } = render(
      <ArchaeopteryxPhylogeny xml="<phyloxml />" title="Test tree" />,
    );
    await waitFor(() => {
      expect(container.querySelector(".aptx-panel")).toHaveClass("aptx-dark");
    });
    expect(toggleTheme).not.toHaveBeenCalled();

    document.documentElement.dataset.theme = "dxkb-light";

    await waitFor(() => {
      expect(container.querySelector(".aptx-panel")).toHaveClass("aptx-light");
    });
    expect(toggleTheme).toHaveBeenCalledOnce();
    expect(renderer.launch).toHaveBeenCalledOnce();
    expect(destroy).not.toHaveBeenCalled();
  });

  it("catches up with a theme change made before a deferred draw", async () => {
    let drawNextFrame: () => void = () => undefined;
    const { renderer, toggleTheme } = createFakeArchaeopteryx({
      drawWhen: new Promise((resolve) => {
        drawNextFrame = resolve;
      }),
    });

    const { container } = render(
      <ArchaeopteryxPhylogeny xml="<phyloxml />" title="Test tree" />,
    );
    await waitFor(() => {
      expect(renderer.launch).toHaveBeenCalledOnce();
    });
    // Launched light, with no panel yet for the theme observer to switch.
    document.documentElement.dataset.theme = "dxkb-dark";
    await new Promise(requestAnimationFrame);
    drawNextFrame();

    await waitFor(() => {
      expect(container.querySelector(".aptx-panel")).toHaveClass("aptx-dark");
    });
    expect(toggleTheme).toHaveBeenCalledOnce();
  });

  it("destroys the viewer on unmount", async () => {
    const { destroy } = createFakeArchaeopteryx();

    const { container, unmount } = render(
      <ArchaeopteryxPhylogeny
        xml="<phyloxml />"
        title="Test tree"
        selectable
      />,
    );
    await waitFor(() => {
      expect(container.querySelector(".aptx-panel")).not.toBeNull();
    });
    const removeEventListener = vi.spyOn(document, "removeEventListener");

    unmount();

    expect(destroy).toHaveBeenCalledOnce();
    expect(ResizeObserverStub.instances[0]?.disconnect).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledWith(
      "selected_nodes_changed_event",
      expect.any(Function),
    );
  });

  it("shows the viewer's own error and tears down when the tree cannot be drawn", async () => {
    const { destroy } = createFakeArchaeopteryx({
      ready: Promise.reject(new Error("renderer failed to draw")),
    });

    render(
      <ArchaeopteryxPhylogeny
        xml="<phyloxml />"
        title="Test tree"
        selectable
      />,
    );

    expect(
      await screen.findByText("renderer failed to draw"),
    ).toBeInTheDocument();
    expect(destroy).toHaveBeenCalledOnce();
    expect(ResizeObserverStub.instances[0]?.disconnect).toHaveBeenCalledOnce();
  });

  it("shows a launch error without destroying a viewer it never mounted", async () => {
    const { destroy } = createFakeArchaeopteryx({
      launchError: new Error(
        'ArchaeopteryxJS: ERROR: unknown config key(s) passed to launch: "x"',
      ),
    });

    render(<ArchaeopteryxPhylogeny xml="<phyloxml />" title="Test tree" />);

    expect(
      await screen.findByText(
        'ArchaeopteryxJS: ERROR: unknown config key(s) passed to launch: "x"',
      ),
    ).toBeInTheDocument();
    expect(destroy).not.toHaveBeenCalled();
  });

  it("does not rethrow a loader failure when the error view unmounts", async () => {
    vi.mocked(loadArchaeopteryx).mockRejectedValue(
      new Error("renderer failed to load"),
    );

    const { unmount } = render(
      <ArchaeopteryxPhylogeny xml="<phyloxml />" title="Test tree" />,
    );

    expect(
      await screen.findByText("renderer failed to load"),
    ).toBeInTheDocument();

    unmount();
    await Promise.resolve();
  });
});
