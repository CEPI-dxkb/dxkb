import type {
  Archaeopteryx,
  ArchaeopteryxConfig,
  Phylogeny,
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

// Archaeopteryx keeps its light/dark choice here and reads it at launch.
const panelThemeStorageKey = "aptx-panel-theme";

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
  // The bundler cannot resolve the viewer's guarded require() calls, so it reads its dependencies from these globals.
  globals.d3 = d3Module;
  globals.forester = foresterModule.forester;
  globals.phyloXml = phyloXmlModule.phyloXml;
  // Archaeopteryx offers PNG/PDF downloads only when these globals exist.
  globals.Canvg = canvgModule.Canvg;
  globals.jspdf = { jsPDF: jspdfModule.jsPDF };
  // svg2pdf.js registers jsPDF.API.svg on the jspdf it imports, or on the global when loaded as a script.
  await import("svg2pdf.js");

  const archaeopteryxModule = await import("archaeopteryx");
  return archaeopteryxModule.archaeopteryx;
}

/** Launches a viewer whose destroy() is a no-op once a newer one has launched; Archaeopteryx keeps one viewer per page. */
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

/** Archaeopteryx throws on an unknown key, so unit tests launch the real viewer with this. */
export function createViewerConfig(
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
    zoomToFitUponWindowResize: true,
    // Matches the legacy viral default; Archaeopteryx picks its own when a tree lacks the field.
    ...(!selectable && { initialVisualization: "Host" }),
  };
}

export function documentViewerTheme(): ViewerTheme {
  return document.documentElement.dataset.theme?.endsWith("-dark")
    ? "dark"
    : "light";
}

export function seedViewerTheme(theme: ViewerTheme) {
  try {
    localStorage.setItem(panelThemeStorageKey, theme);
  } catch {
    // storage unavailable
  }
}

/** Switches a running viewer's theme in place by flipping its own switch, which keeps zoom, selection and searches. */
export function syncViewerTheme(container: Element, theme: ViewerTheme) {
  const panel = container.querySelector(".aptx-panel");
  const toggle = container.querySelector<HTMLButtonElement>(".aptx-theme-btn");
  if (!panel || !toggle) return;
  // A panel still following the OS carries neither class, so its first toggle can land on the opposite theme.
  for (
    let attempt = 0;
    attempt < 2 && !panel.classList.contains(`aptx-${theme}`);
    attempt += 1
  ) {
    toggle.click();
  }
}

/** Folds or opens a running viewer's control panel by clicking its own hide/show button, since Archaeopteryx only takes this at launch. Returns whether the panel changed. */
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
