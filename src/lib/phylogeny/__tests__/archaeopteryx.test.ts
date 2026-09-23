import type { Archaeopteryx } from "archaeopteryx";

import {
  collectNodeLabels,
  type MountedViewer,
  createViewerConfig,
  documentViewerTheme,
  loadArchaeopteryx,
  mountArchaeopteryx,
  seedViewerTheme,
  syncViewerTheme,
} from "../archaeopteryx";

const maliciousName = '<img src=x onerror="window.__treeXss = true">';

function escapeXml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function leaf(name: string, host: string, extra = "") {
  return `<clade>
    <name>${escapeXml(name)}</name>
    <branch_length>0.1</branch_length>
    <property ref="dxkb:host_common_name" datatype="xsd:string" applies_to="node">${host}</property>
    ${extra}
  </clade>`;
}

const treeXml = `<?xml version="1.0" encoding="UTF-8"?>
<phyloxml xmlns="http://www.phyloxml.org">
  <phylogeny rooted="true">
    <clade>
      <name>Root</name>
      <property ref="dxkb:in-group" datatype="xsd:string" applies_to="node">Yes</property>
      ${leaf(maliciousName, "Human")}
      ${leaf("Leaf B", "Animal", '<property ref="dxkb:genome_name" datatype="xsd:string" applies_to="clade">Genome B</property>')}
    </clade>
  </phylogeny>
</phyloxml>`;

// jsdom implements neither SVG geometry nor text measurement, both of which
// the viewer reads while it lays out and zooms the tree.
function stubSvgGeometry() {
  const restores: (() => void)[] = [];
  const define = (
    target: object,
    key: string,
    descriptor: PropertyDescriptor,
  ) => {
    const previous = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, ...descriptor });
    restores.push(() => {
      if (previous) Object.defineProperty(target, key, previous);
      else Reflect.deleteProperty(target, key);
    });
  };
  for (const dimension of ["width", "height"]) {
    define(SVGSVGElement.prototype, dimension, {
      get(this: SVGSVGElement) {
        return {
          baseVal: { value: Number(this.getAttribute(dimension)) || 0 },
        };
      },
    });
  }
  const textWidth = (element: Element) => element.textContent.length * 6;
  define(SVGElement.prototype, "getBBox", {
    value(this: SVGElement) {
      return { x: 0, y: 0, width: textWidth(this), height: 10 };
    },
  });
  define(SVGElement.prototype, "getComputedTextLength", {
    value(this: SVGElement) {
      return textWidth(this);
    },
  });
  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

describe("loadArchaeopteryx", () => {
  it("publishes the d3 v7 runtime and the optional export libraries without jQuery", async () => {
    const archaeopteryx = await loadArchaeopteryx();
    const globals = window as Window & {
      d3?: { zoom?: unknown; cluster?: unknown };
      forester?: unknown;
      phyloXml?: { parse?: unknown };
      Canvg?: { fromString?: unknown };
      jspdf?: { jsPDF?: { API?: { svg?: unknown } } };
      jQuery?: unknown;
    };

    expect(globals.d3?.zoom).toBeTypeOf("function");
    expect(globals.d3?.cluster).toBeTypeOf("function");
    expect(globals.forester).toHaveProperty("visualizationCandidates");
    expect(globals.phyloXml?.parse).toBeTypeOf("function");
    expect(globals.Canvg?.fromString).toBeTypeOf("function");
    expect(globals.jspdf?.jsPDF?.API?.svg).toBeTypeOf("function");
    expect(globals.jQuery).toBeUndefined();
    expect(typeof archaeopteryx.launch).toBe("function");
    expect(typeof archaeopteryx.parsePhyloXML).toBe("function");
    expect(typeof archaeopteryx.getSelectedNodes).toBe("function");
    await expect(loadArchaeopteryx()).resolves.toBe(archaeopteryx);
  });

  it("retries after a transient dependency-load failure instead of caching the rejection", async () => {
    vi.resetModules();
    const actualD3 = await vi.importActual<Record<string, unknown>>("d3");
    let attempt = 0;
    vi.doMock("d3", () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error("transient dependency failure");
      }
      return actualD3;
    });

    const fresh = await import("../archaeopteryx");
    await expect(fresh.loadArchaeopteryx()).rejects.toThrow();

    const archaeopteryx = await fresh.loadArchaeopteryx();
    expect(typeof archaeopteryx.parsePhyloXML).toBe("function");

    vi.doUnmock("d3");
  });
});

describe("collectNodeLabels", () => {
  it("offers a checkbox for each node property at any depth", async () => {
    const archaeopteryx = await loadArchaeopteryx();
    const labels = collectNodeLabels(archaeopteryx.parsePhyloXML(treeXml));

    expect(labels).toEqual({
      host_common_name: {
        label: "Host Common Name",
        propertyRef: "dxkb:host_common_name",
        description: "the Host Common Name",
        showButton: true,
      },
      "in-group": {
        label: "In Group",
        propertyRef: "dxkb:in-group",
        description: "the In Group",
        showButton: true,
      },
    });
  });

  it("skips property keys that are not plain identifiers", () => {
    const labels = collectNodeLabels({
      children: [
        {
          properties: [
            { ref: `dxkb:${maliciousName}`, value: "x", applies_to: "node" },
            { ref: 'dxkb:a" onmouseover="x', value: "x", applies_to: "node" },
            { ref: "dxkb:__", value: "x", applies_to: "node" },
            { ref: "dxkb:year", value: "2020", applies_to: "node" },
          ],
        },
      ],
    });

    expect(Object.keys(labels)).toEqual(["year"]);
  });
});

describe("createViewerConfig", () => {
  it("opens viral trees on the Host visualization and only lets bacterial trees select leaves", () => {
    const tree = { children: [] };

    expect(
      createViewerConfig(tree, {
        selectable: false,
        collapseControlPanel: false,
      }),
    ).toMatchObject({
      enableManualNodeSelection: false,
      initialVisualization: "Host",
    });
    const bacterial = createViewerConfig(tree, {
      selectable: true,
      collapseControlPanel: true,
    });
    expect(bacterial).toMatchObject({
      collapseControlPanel: true,
      enableManualNodeSelection: true,
      enableAccessToDatabases: false,
      enableSubtreeDeletion: false,
    });
    expect(bacterial).not.toHaveProperty("initialVisualization");
  });
});

describe("viewer theme", () => {
  afterEach(() => {
    document.documentElement.dataset.theme = "dxkb-light";
    localStorage.removeItem("aptx-panel-theme");
  });

  it("reads light or dark from the site theme", () => {
    document.documentElement.dataset.theme = "bvbrc-dark";
    expect(documentViewerTheme()).toBe("dark");
    document.documentElement.dataset.theme = "dxkb-light";
    expect(documentViewerTheme()).toBe("light");
    delete document.documentElement.dataset.theme;
    expect(documentViewerTheme()).toBe("light");
  });

  it("stores the choice where the viewer reads it at launch", () => {
    seedViewerTheme("dark");
    expect(localStorage.getItem("aptx-panel-theme")).toBe("dark");
  });

  it("flips a panel that still follows the OS until it matches", () => {
    document.body.innerHTML = `
      <div id="host">
        <div class="aptx-panel"></div>
        <button class="aptx-theme-btn"></button>
      </div>
    `;
    const host = document.getElementById("host") as HTMLElement;
    const panel = host.querySelector(".aptx-panel") as HTMLElement;
    const toggle = host.querySelector(".aptx-theme-btn") as HTMLElement;
    // Like the real switch, the first press from the OS default goes light.
    const themes = ["aptx-light", "aptx-dark"];
    const click = vi.fn(() => {
      const next = themes[click.mock.calls.length - 1] ?? "aptx-light";
      panel.className = `aptx-panel ${next}`;
    });
    toggle.addEventListener("click", click);

    syncViewerTheme(host, "dark");
    expect(panel).toHaveClass("aptx-dark");
    expect(click).toHaveBeenCalledTimes(2);

    syncViewerTheme(host, "dark");
    expect(click).toHaveBeenCalledTimes(2);
    document.body.innerHTML = "";
  });
});

describe("mountArchaeopteryx with the real viewer", () => {
  let archaeopteryx: Archaeopteryx;
  let restoreGeometry: () => void;
  let host: HTMLElement;
  let mounted: MountedViewer[] = [];

  beforeAll(async () => {
    archaeopteryx = await loadArchaeopteryx();
  });

  beforeEach(() => {
    restoreGeometry = stubSvgGeometry();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    document.body.innerHTML = '<div id="tree"></div>';
    host = document.getElementById("tree") as HTMLElement;
  });

  afterEach(() => {
    // The viewer keeps its body-level tooltip across launches, so each test
    // must unmount before the next one clears the page.
    for (const viewer of mounted.reverse()) viewer.destroy();
    mounted = [];
    document.body.innerHTML = "";
    localStorage.removeItem("aptx-panel-theme");
    delete (window as { __treeXss?: boolean }).__treeXss;
    restoreGeometry();
  });

  const mount = async (
    options: { selectable?: boolean } = {},
    container: Element = host,
  ) => {
    const tree = archaeopteryx.parsePhyloXML(treeXml);
    const viewer = mountArchaeopteryx(archaeopteryx, container, tree, {
      ...createViewerConfig(tree, {
        selectable: options.selectable ?? true,
        collapseControlPanel: false,
      }),
      // jsdom lays out nothing, so give the tree a fixed canvas.
      enableDynamicSizing: false,
      displayWidth: 800,
      displayHeight: 600,
    });
    mounted.push(viewer);
    await viewer.ready;
    return viewer;
  };

  it("accepts the DXKB launch config and draws the tree with its control panel", async () => {
    await mount({ selectable: false });

    expect(
      host.querySelector(":scope > svg rect.basebackground"),
    ).not.toBeNull();
    expect(host.querySelectorAll(":scope > .aptx-panel")).toHaveLength(1);
    const labels = Array.from(
      host.querySelectorAll(".aptx-panel label"),
      (label) => label.textContent,
    );
    expect(labels).toEqual(
      expect.arrayContaining(["Node Name", "Host Common Name", "In Group"]),
    );
    const formats = Array.from(
      host.querySelectorAll("#exp_f_sel option"),
      (option) => option.textContent,
    );
    expect(formats).toEqual(
      expect.arrayContaining(["PNG", "PDF", "SVG", "phyloXML", "Newick"]),
    );
  });

  it("shows tree-derived names in the hover tooltip as text, not markup", async () => {
    await mount();

    const node = Array.from(host.querySelectorAll<SVGGElement>("g.node")).find(
      (element) =>
        (element as SVGGElement & { __data__?: { name?: string } }).__data__
          ?.name === maliciousName,
    );
    const position = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(
      node?.getAttribute("transform") ?? "",
    );
    expect(position).not.toBeNull();
    node?.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: Number(position?.[1]),
        clientY: Number(position?.[2]),
      }),
    );

    const tooltip = document.querySelector(".aptx-tip");
    expect(tooltip?.textContent).toContain(maliciousName);
    expect(document.querySelector("img")).toBeNull();
    expect((window as { __treeXss?: boolean }).__treeXss).toBeUndefined();
  });

  it("reports leaves selected from the node menu", async () => {
    const viewer = await mount();
    const selectionChanged = vi.fn();
    document.addEventListener("selected_nodes_changed_event", selectionChanged);

    const leafNode = Array.from(host.querySelectorAll("g.node")).find(
      (element) =>
        (element as Element & { __data__?: { name?: string } }).__data__
          ?.name === "Leaf B",
    );
    const position = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(
      leafNode?.getAttribute("transform") ?? "",
    );
    leafNode?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: Number(position?.[1]),
        clientY: Number(position?.[2]),
      }),
    );
    const select = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".aptx-node-menu button"),
    ).find((button) => button.textContent === "Select/Deselect Node");
    expect(select).toBeDefined();
    select?.click();

    expect(selectionChanged).toHaveBeenCalledOnce();
    expect(viewer.getSelectedNodes().map((node) => node.name)).toEqual([
      "Leaf B",
    ]);
    document.removeEventListener(
      "selected_nodes_changed_event",
      selectionChanged,
    );
  });

  it("switches theme in place, keeping the drawn tree", async () => {
    seedViewerTheme("dark");
    await mount();
    const svg = host.querySelector(":scope > svg");
    const background = host.querySelector<SVGRectElement>(
      "rect.basebackground",
    );
    const darkFill = background?.getAttribute("style");

    expect(host.querySelector(".aptx-panel")).toHaveClass("aptx-dark");
    syncViewerTheme(host, "light");

    expect(host.querySelector(".aptx-panel")).toHaveClass("aptx-light");
    expect(host.querySelector(":scope > svg")).toBe(svg);
    expect(background?.getAttribute("style")).not.toBe(darkFill);
  });

  it("removes its DOM and every document listener it added when destroyed", async () => {
    const added: [string, EventListenerOrEventListenerObject][] = [];
    const removed: [string, EventListenerOrEventListenerObject][] = [];
    const addEventListener = document.addEventListener.bind(document);
    const removeEventListener = document.removeEventListener.bind(document);
    vi.spyOn(document, "addEventListener").mockImplementation(
      (type, listener, options) => {
        added.push([type, listener]);
        addEventListener(type, listener, options);
      },
    );
    vi.spyOn(document, "removeEventListener").mockImplementation(
      (type, listener, options) => {
        removed.push([type, listener]);
        removeEventListener(type, listener, options);
      },
    );

    const viewer = await mount();
    expect(added.length).toBeGreaterThan(0);
    viewer.destroy();

    expect(host.childElementCount).toBe(0);
    expect(document.querySelector(".aptx-tip, .aptx-node-menu")).toBeNull();
    // Upstream never removes its search-suggestion scroll handler, but it is
    // one module-level function the DOM registers once and a no-op without
    // open suggestions.
    expect(removed).toEqual(
      expect.arrayContaining(added.filter(([type]) => type !== "scroll")),
    );
    expect(added.map(([type]) => type)).toEqual(
      expect.arrayContaining(["keydown", "keyup", "wheel"]),
    );
  });

  it("ignores destroy() from a viewer that a newer launch replaced", async () => {
    const stale = await mount();
    const next = document.createElement("div");
    document.body.append(next);
    const current = await mount({}, next);

    stale.destroy();
    expect(next.querySelector(".aptx-panel")).not.toBeNull();

    current.destroy();
    expect(next.childElementCount).toBe(0);
  });
});
