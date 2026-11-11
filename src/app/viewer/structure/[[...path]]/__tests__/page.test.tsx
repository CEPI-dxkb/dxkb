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

// The real viewer instantiates Mol*, which needs WebGL; capture the props the
// route composes instead.
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
 * `page.tsx` reads `params` through `use()`, which resolves a fulfilled
 * thenable (`status: "fulfilled"` plus `value`) synchronously, so no Suspense
 * boundary is needed.
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

    // `regionState: "full"` is the standalone route's reason to exist (the
    // workspace preview passes "hidden"); asserted whole so a third key cannot
    // appear unnoticed.
    expect(viewer.layout).toEqual({ showControls: true, regionState: "full" });
    // `isolate` keeps Mol*'s z-1000+ overlays below the navbar's popups.
    expect(viewer.containerClassName).toBe("isolate size-full");
  });

  it("decodes the per-segment encoding Next gives a page component", () => {
    // Next hands page components each segment percent-encoded, so a file named
    // "model 1.cif" under "alice@bvbrc" arrives encoded.
    renderPage(["alice%40bvbrc", "home", "model%201.cif"]);

    // Decoded once, then re-encoded once; forwarding `params` raw would
    // double-encode.
    expect(viewer.source).toEqual({
      url: "/api/workspace/view/alice%40bvbrc/home/model%201.cif",
      format: "mmcif",
      label: "model 1.cif",
      kind: "workspace",
    });
    expect(screen.getByText("model 1.cif")).toBeVisible();
  });

  it("keeps a literal %2F in a filename as text, not an extra path segment", () => {
    // Decoding exactly once recovers the real name; decoding twice would
    // request ".../weird/file.pdb".
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
