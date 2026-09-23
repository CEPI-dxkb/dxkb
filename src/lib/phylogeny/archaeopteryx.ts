import type {
  Archaeopteryx,
  ArchaeopteryxConfig,
  NodeLabelSpec,
  Phylogeny,
  PhylogenyNode,
  ViewerHandle,
} from "archaeopteryx";

export type { Archaeopteryx, ArchaeopteryxConfig, Phylogeny };

export interface ArchaeopteryxProperty {
  ref?: string;
  value?: string | number;
  applies_to?: string;
  unit?: string;
}

export interface ArchaeopteryxNode {
  name?: string;
  branch_length?: number;
  confidences?: { value?: number; type?: string }[];
  taxonomies?: { scientific_name?: string }[];
  properties?: ArchaeopteryxProperty[];
  children?: ArchaeopteryxNode[];
  parent?: ArchaeopteryxNode;
}

export type ViewerTheme = "light" | "dark";

export interface MountedViewer {
  /** Resolves once the tree has been drawn. */
  ready: Promise<void>;
  getSelectedNodes: () => ArchaeopteryxNode[];
  destroy: () => void;
}

interface CanvgModule {
  Canvg: { fromString: unknown };
}

interface JspdfModule {
  jsPDF: unknown;
}

interface ArchaeopteryxGlobals extends Window {
  d3?: unknown;
  forester?: unknown;
  phyloXml?: unknown;
  Canvg?: unknown;
  jspdf?: { jsPDF: unknown };
}

// Archaeopteryx keeps the light/dark choice of its panel and canvas here, and
// reads it when a viewer launches.
const panelThemeStorageKey = "aptx-panel-theme";

// Custom label keys become element ids and are concatenated into the control
// panel's HTML unescaped, so only plain identifiers are offered.
const safeLabelKey = /^[A-Za-z0-9_-]+$/;

let loader: Promise<Archaeopteryx> | null = null;
let activeViewer: ViewerHandle | null = null;

export function loadArchaeopteryx(): Promise<Archaeopteryx> {
  loader ??= loadDependencies().catch((cause: unknown) => {
    loader = null;
    throw cause;
  });
  return loader;
}

async function loadDependencies(): Promise<Archaeopteryx> {
  const globals = window as ArchaeopteryxGlobals;
  const [d3Module, foresterModule, phyloXmlModule, canvgModule, jspdfModule] =
    await Promise.all([
      import("d3") as Promise<unknown>,
      import("archaeopteryx/forester"),
      import("phyloxml"),
      import("canvg") as Promise<CanvgModule>,
      import("jspdf") as Promise<JspdfModule>,
    ]);
  // The bundler cannot resolve the guarded require() calls in the viewer's UMD
  // header, so the bundled viewer reads its dependencies from these globals.
  globals.d3 = d3Module;
  globals.forester = foresterModule.forester;
  globals.phyloXml = phyloXmlModule.phyloXml;
  // Archaeopteryx offers PNG and PDF downloads only when these page-level
  // globals exist; neither library publishes one itself.
  globals.Canvg = canvgModule.Canvg;
  globals.jspdf = { jsPDF: jspdfModule.jsPDF };
  // svg2pdf.js registers jsPDF.API.svg on jspdf: the one it imports, or the
  // global above when it is loaded as a plain script.
  await import("svg2pdf.js");

  const archaeopteryxModule = await import("archaeopteryx");
  return archaeopteryxModule.archaeopteryx;
}

/**
 * Launches a viewer whose destroy() is a no-op once a newer viewer has
 * launched. Archaeopteryx keeps one viewer per page in module state, so every
 * handle's destroy() would otherwise tear down whichever viewer is current.
 */
export function mountArchaeopteryx(
  archaeopteryx: Archaeopteryx,
  container: Element,
  tree: Phylogeny,
  config: ArchaeopteryxConfig,
): MountedViewer {
  // `ready` is documented but missing from the package's type definitions.
  const viewer: ViewerHandle & { ready?: Promise<void> } = archaeopteryx.launch(
    container,
    tree,
    config,
  );
  activeViewer = viewer;
  return {
    ready: viewer.ready ?? Promise.resolve(),
    getSelectedNodes: () => viewer.getSelectedNodes(),
    destroy: () => {
      if (activeViewer !== viewer) return;
      activeViewer = null;
      viewer.destroy();
    },
  };
}

/**
 * The launch config shared by every DXKB tree. Archaeopteryx throws on an
 * unknown key, so this is also what its unit tests launch the real viewer with.
 */
export function createViewerConfig(
  tree: Phylogeny,
  {
    selectable,
    collapseControlPanel,
  }: { selectable: boolean; collapseControlPanel: boolean },
): ArchaeopteryxConfig {
  return {
    collapseControlPanel,
    enableAccessToDatabases: false,
    enableDownloads: true,
    enableDynamicSizing: true,
    enableManualNodeSelection: selectable,
    enableSubtreeDeletion: false,
    nodeLabels: collectNodeLabels(tree),
    zoomToFitUponWindowResize: true,
    // Matches the legacy OutbreaksPhylogenyTreeViewer.js viral default;
    // Archaeopteryx falls back to its own pick when a tree lacks the field.
    ...(!selectable && { initialVisualization: "Host" }),
  };
}

/** Offers a label checkbox for every node property the tree carries. */
export function collectNodeLabels(
  tree: Phylogeny,
): Record<string, NodeLabelSpec> {
  const refs = new Set<string>();
  const pending: PhylogenyNode[] = [tree];
  for (let node = pending.pop(); node; node = pending.pop()) {
    for (const property of node.properties ?? []) {
      if (property.ref && property.applies_to === "node")
        refs.add(property.ref);
    }
    pending.push(...(node.children ?? []));
  }

  const labels: Record<string, NodeLabelSpec> = {};
  for (const ref of refs) {
    const key = ref.replace(/^.*:/, "");
    if (!safeLabelKey.test(key)) continue;
    const label = key
      .replaceAll(/[_-]+/g, " ")
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase());
    if (!label) continue;
    labels[key] = {
      label,
      propertyRef: ref,
      description: `the ${label}`,
      showButton: true,
    };
  }
  return labels;
}

export function documentViewerTheme(): ViewerTheme {
  return document.documentElement.dataset.theme?.endsWith("-dark")
    ? "dark"
    : "light";
}

/** Makes the next launched viewer draw in the given theme from the start. */
export function seedViewerTheme(theme: ViewerTheme) {
  try {
    localStorage.setItem(panelThemeStorageKey, theme);
  } catch {
    // Without storage the viewer follows the OS color scheme instead.
  }
}

/**
 * Switches a running viewer to the given theme in place. Archaeopteryx has no
 * API for this, so it flips the viewer's own light/dark switch, which keeps
 * the zoom, selection and searches the user has.
 */
export function syncViewerTheme(container: Element, theme: ViewerTheme) {
  const panel = container.querySelector(".aptx-panel");
  const toggle = container.querySelector<HTMLButtonElement>(".aptx-theme-btn");
  if (!panel || !toggle) return;
  // A panel still following the OS carries neither class, and its first
  // toggle can land on the opposite theme, hence the second attempt.
  for (
    let attempt = 0;
    attempt < 2 && !panel.classList.contains(`aptx-${theme}`);
    attempt += 1
  ) {
    toggle.click();
  }
}

/**
 * Folds a running viewer's control panel to its header bar, or opens it.
 * Archaeopteryx only takes this at launch, so it clicks the panel's own
 * hide/show button, leaving the panel as if the user had pressed it. Returns
 * whether the panel changed.
 */
export function setViewerControlsCollapsed(
  container: Element,
  collapsed: boolean,
): boolean {
  const panel = container.querySelector(".aptx-panel");
  const toggle = container.querySelector<HTMLButtonElement>(".aptx-hide-btn");
  if (!panel || !toggle) return false;
  if (panel.classList.contains("aptx-hidden") === collapsed) return false;
  toggle.click();
  return true;
}
