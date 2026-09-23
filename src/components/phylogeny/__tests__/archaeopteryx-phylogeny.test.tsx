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

  constructor(readonly callback: () => void) {
    ResizeObserverStub.instances.push(this);
  }
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

// jsdom lays out nothing, so every element reports this width.
let hostWidth = 1024;
vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
  () => hostWidth,
);

/** Resizes the host the way the side panel or a window resize would. */
async function resizeHost(width: number) {
  hostWidth = width;
  for (const observer of ResizeObserverStub.instances) observer.callback();
  await new Promise(requestAnimationFrame);
}

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
          // Like the real header button, it folds the panel to its header.
          const hide = document.createElement("button");
          hide.className = "aptx-hide-btn";
          hide.addEventListener("click", () => {
            panel.classList.toggle("aptx-hidden");
          });
          if (config.collapseControlPanel) panel.classList.add("aptx-hidden");
          panel.append(toggle, hide);
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
    hostWidth = 1024;
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

  it("lets a selectable tree pick leaves and collapses the panel in a narrow host", async () => {
    hostWidth = 480;
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

  it("folds the controls when the host narrows and restores them when it widens", async () => {
    createFakeArchaeopteryx();
    const windowResized = vi.fn();
    window.addEventListener("resize", windowResized);

    const { container } = render(
      <ArchaeopteryxPhylogeny xml="<phyloxml />" title="Test tree" />,
    );
    await waitFor(() => {
      expect(container.querySelector(".aptx-panel")).not.toBeNull();
    });
    const panel = container.querySelector(".aptx-panel");
    expect(panel).not.toHaveClass("aptx-hidden");

    await resizeHost(480);
    expect(panel).toHaveClass("aptx-hidden");
    expect(windowResized).toHaveBeenCalledOnce();

    await resizeHost(1024);
    expect(panel).not.toHaveClass("aptx-hidden");
    window.removeEventListener("resize", windowResized);
  });

  it("leaves the controls as the user set them until the next crossing", async () => {
    hostWidth = 480;
    createFakeArchaeopteryx();

    const { container } = render(
      <ArchaeopteryxPhylogeny xml="<phyloxml />" title="Test tree" />,
    );
    await waitFor(() => {
      expect(container.querySelector(".aptx-panel")).toHaveClass(
        "aptx-hidden",
      );
    });
    const panel = container.querySelector(".aptx-panel");
    const hide = container.querySelector<HTMLButtonElement>(".aptx-hide-btn");

    // Opened by hand in a narrow host, it stays open as the host narrows
    // further and once it widens.
    hide?.click();
    await resizeHost(400);
    expect(panel).not.toHaveClass("aptx-hidden");
    await resizeHost(1024);
    expect(panel).not.toHaveClass("aptx-hidden");

    // Folded by hand, it is not reopened by a round trip through narrow.
    hide?.click();
    await resizeHost(480);
    await resizeHost(1024);
    expect(panel).toHaveClass("aptx-hidden");
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
