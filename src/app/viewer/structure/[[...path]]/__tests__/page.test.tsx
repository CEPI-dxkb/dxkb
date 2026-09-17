import { render, screen } from "@testing-library/react";
import type { StructureSource } from "@/lib/protein-structure-view/source";
import type { MolstarLayoutSpec } from "@/components/workspace/file-viewer/viewers/use-molstar-plugin";
import StructureViewerPage from "../page";

const viewer = vi.hoisted(() => ({
  source: undefined as StructureSource | undefined,
  layout: undefined as MolstarLayoutSpec | undefined,
  containerClassName: undefined as string | undefined,
  renders: 0,
}));

// The real viewer instantiates Mol*, which needs WebGL. Capture the props the
// route composes instead — this suite is about what the page hands the viewer,
// not about rendering a structure. Mol* itself is covered by
// structure-source-viewer.test.tsx and use-molstar-plugin's own suite.
vi.mock(
  "@/components/workspace/file-viewer/viewers/structure-source-viewer",
  () => ({
    StructureSourceViewer: (props: {
      source: StructureSource;
      layout: MolstarLayoutSpec;
      containerClassName?: string;
    }) => {
      viewer.source = props.source;
      viewer.layout = props.layout;
      viewer.containerClassName = props.containerClassName;
      viewer.renders += 1;
      return <div data-testid="structure-viewer" />;
    },
  }),
);

beforeEach(() => {
  viewer.source = undefined;
  viewer.layout = undefined;
  viewer.containerClassName = undefined;
  viewer.renders = 0;
});

/**
 * `page.tsx` reads `params` through `use()`. React resolves an
 * already-fulfilled thenable synchronously — `status: "fulfilled"` plus
 * `value` is the shape it checks — which is how Next hands a client page its
 * params through the RSC payload, and lets these assertions run without a
 * Suspense boundary.
 */
function renderPage(path?: string[]) {
  const value = { path };
  const params = Promise.resolve(value) as Promise<typeof value> & {
    status?: "fulfilled";
    value?: typeof value;
  };
  params.status = "fulfilled";
  params.value = value;
  render(<StructureViewerPage params={params} />);
}

describe("/viewer/structure/[[...path]] route composition", () => {
  it("renders the empty state and no viewer for a bare /viewer/structure", () => {
    renderPage(undefined);
    expect(screen.getByText("No file path provided.")).toBeVisible();
    expect(screen.queryByTestId("structure-viewer")).not.toBeInTheDocument();
    expect(viewer.renders).toBe(0);
  });

  it("renders the empty state for an empty segment array", () => {
    renderPage([]);
    expect(screen.getByText("No file path provided.")).toBeVisible();
    expect(screen.queryByTestId("structure-viewer")).not.toBeInTheDocument();
    expect(viewer.renders).toBe(0);
  });

  it("gives the viewer full Mol* panels, not the workspace preview layout", () => {
    renderPage(["alice%40bvbrc", "home", "model.cif"]);
    expect(screen.getByTestId("structure-viewer")).toBeInTheDocument();

    // The standalone route's whole reason to exist: `regionState: "full"` opens
    // every Mol* region, where the in-workspace file preview passes "hidden".
    // Asserted as a whole object so a third layout key cannot appear unnoticed.
    expect(viewer.layout).toEqual({ showControls: true, regionState: "full" });
    expect(viewer.containerClassName).toBe("size-full");
  });

  it("decodes the per-segment encoding Next gives a page component", () => {
    // Next's route matcher decodes each matched segment, then
    // `getParamValue()` maps `encodeURIComponent` back over the array before a
    // page component sees it. For a workspace file really named "model 1.cif"
    // under "alice@bvbrc", the page therefore receives these.
    renderPage(["alice%40bvbrc", "home", "model%201.cif"]);

    // Decoded once by `readRouteParamSegments(…, "page")`, then re-encoded once
    // by `buildWorkspaceStructureSource`. Forwarding `params` raw would
    // double-encode: "alice%2540bvbrc" in the URL and a literal "model%201.cif"
    // as the label.
    expect(viewer.source).toEqual({
      url: "/api/workspace/view/alice%40bvbrc/home/model%201.cif",
      format: "mmcif",
      label: "model 1.cif",
      kind: "workspace",
    });
    expect(screen.getByText("model 1.cif")).toBeVisible();
  });

  it("keeps a literal %2F in a filename as text, not an extra path segment", () => {
    // A file named "weird%2Ffile.pdb" arrives as "weird%252Ffile.pdb". Decoding
    // exactly once recovers the real name; decoding twice would turn it into a
    // request for ".../weird/file.pdb".
    renderPage(["alice%40bvbrc", "home", "weird%252Ffile.pdb"]);

    expect(viewer.source).toEqual({
      url: "/api/workspace/view/alice%40bvbrc/home/weird%252Ffile.pdb",
      format: "pdb",
      label: "weird%2Ffile.pdb",
      kind: "workspace",
    });
  });

  it("names the file in the header alongside a back control", () => {
    renderPage(["alice%40bvbrc", "home", "model.bcif"]);

    expect(screen.getByText("model.bcif")).toBeVisible();
    expect(screen.getByRole("button", { name: "Go back" })).toBeVisible();
    expect(viewer.source).toMatchObject({ format: "bcif" });
  });
});
