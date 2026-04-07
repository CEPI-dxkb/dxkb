import { render, screen, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// jsdom stubs — ResizeObserver is not implemented in jsdom.
// ---------------------------------------------------------------------------

class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  callback: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
  }
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

// ---------------------------------------------------------------------------
// Mol* mocks — the hook now loads the pre-built bundle via <script> tag and
// uses the global `molstar.Viewer.create()` API. We mock the global and the
// DOM helpers instead of individual ESM imports.
// ---------------------------------------------------------------------------

const mockDispose = vi.fn();
const mockHandleResize = vi.fn();
const mockLoadAllModels = vi.fn().mockResolvedValue(undefined);

const mockViewer = {
  dispose: mockDispose,
  plugin: { canvas3d: { handleResize: mockHandleResize } },
  loadAllModelsOrAssemblyFromUrl: mockLoadAllModels,
};

const mockViewerCreate = vi.fn(() => Promise.resolve(mockViewer));

// Pre-populate window.molstar so the hook skips <script> injection
vi.stubGlobal("molstar", { Viewer: { create: mockViewerCreate } });

vi.mock("../../file-viewer-registry", () => ({
  getProxyUrl: vi.fn(
    (path: string) => `/api/workspace/view/${path.replace(/^\//, "")}`,
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { StructureViewer } from "../structure-viewer";

describe("StructureViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadAllModels.mockResolvedValue(undefined);
  });

  it("shows loading state initially", () => {
    render(
      <StructureViewer filePath="/user@bvbrc/home/model.pdb" fileName="model.pdb" />,
    );

    expect(screen.getByText("Loading viewer\u2026")).toBeInTheDocument();
  });

  it("renders the Mol* container div", () => {
    render(
      <StructureViewer filePath="/user@bvbrc/home/model.pdb" fileName="model.pdb" />,
    );

    expect(screen.getByTestId("molstar-container")).toBeInTheDocument();
  });

  it("loads structure from proxy URL after initialization", async () => {
    const { getProxyUrl } = await import("../../file-viewer-registry");

    render(
      <StructureViewer filePath="/user@bvbrc/home/model.pdb" fileName="model.pdb" />,
    );

    await waitFor(() => {
      expect(getProxyUrl).toHaveBeenCalledWith("/user@bvbrc/home/model.pdb");
    });

    await waitFor(() => {
      expect(mockLoadAllModels).toHaveBeenCalledWith(
        expect.stringContaining("model.pdb"),
        "pdb",
        false,
      );
    });
  });

  it("uses embedded layout spec (controls hidden)", async () => {
    render(
      <StructureViewer filePath="/user@bvbrc/home/model.pdb" fileName="model.pdb" />,
    );

    await waitFor(() => {
      expect(mockViewerCreate).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          layoutShowControls: false,
          collapseRightPanel: true,
        }),
      );
    });
  });

  it("disposes the viewer on unmount", async () => {
    const { unmount } = render(
      <StructureViewer filePath="/user@bvbrc/home/model.pdb" fileName="model.pdb" />,
    );

    await waitFor(() => {
      expect(mockLoadAllModels).toHaveBeenCalled();
    });

    unmount();

    expect(mockDispose).toHaveBeenCalled();
  });

  it("shows error state when initialization fails", async () => {
    mockViewerCreate.mockRejectedValueOnce(
      new Error("WebGL not supported"),
    );

    render(
      <StructureViewer filePath="/user@bvbrc/home/model.pdb" fileName="model.pdb" />,
    );

    await waitFor(() => {
      expect(screen.getByText("WebGL not supported")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("wraps content in ExpandableViewerWrapper with filename as title", () => {
    render(
      <StructureViewer filePath="/user@bvbrc/home/model.pdb" fileName="model.pdb" />,
    );

    expect(
      screen.getByRole("button", { name: "Expand to full screen" }),
    ).toBeInTheDocument();
  });
});
