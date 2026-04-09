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
// Mol* mocks — jsdom has no WebGL, so we mock the entire plugin lifecycle.
// ---------------------------------------------------------------------------

const mockDispose = vi.fn();
const mockDownload = vi.fn();
const mockParseTrajectory = vi.fn();
const mockApplyPreset = vi.fn();
const mockHandleResize = vi.fn();

const mockPlugin = {
  dispose: mockDispose,
  canvas3d: { handleResize: mockHandleResize },
  builders: {
    data: { download: mockDownload },
    structure: {
      parseTrajectory: mockParseTrajectory,
      hierarchy: { applyPreset: mockApplyPreset },
    },
  },
};

vi.mock("molstar/lib/mol-plugin-ui", () => ({
  createPluginUI: vi.fn(() => Promise.resolve(mockPlugin)),
}));

vi.mock("molstar/lib/mol-plugin-ui/react18", () => ({
  renderReact18: vi.fn(),
}));

vi.mock("molstar/lib/mol-plugin-ui/spec", () => ({
  DefaultPluginUISpec: vi.fn(() => ({})),
}));

// CSS import is a no-op in vitest (css: false in config)
vi.mock("molstar/lib/mol-plugin-ui/skin/light.scss", () => ({}));

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
    mockDownload.mockResolvedValue("mock-data");
    mockParseTrajectory.mockResolvedValue("mock-trajectory");
    mockApplyPreset.mockResolvedValue(undefined);
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
      expect(mockDownload).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining("model.pdb") }),
        expect.anything(),
      );
    });

    await waitFor(() => {
      expect(mockParseTrajectory).toHaveBeenCalledWith("mock-data", "pdb");
    });

    await waitFor(() => {
      expect(mockApplyPreset).toHaveBeenCalledWith(
        "mock-trajectory",
        "default",
      );
    });
  });

  it("uses embedded layout spec (controls hidden)", async () => {
    const { createPluginUI } = await import("molstar/lib/mol-plugin-ui");

    render(
      <StructureViewer filePath="/user@bvbrc/home/model.pdb" fileName="model.pdb" />,
    );

    await waitFor(() => {
      expect(createPluginUI).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            layout: expect.objectContaining({
              initial: expect.objectContaining({
                showControls: false,
                regionState: expect.objectContaining({
                  left: "hidden",
                  right: "hidden",
                }),
              }),
            }),
          }),
        }),
      );
    });
  });

  it("disposes the plugin on unmount", async () => {
    const { unmount } = render(
      <StructureViewer filePath="/user@bvbrc/home/model.pdb" fileName="model.pdb" />,
    );

    // Wait for plugin to be created
    await waitFor(() => {
      expect(mockApplyPreset).toHaveBeenCalled();
    });

    unmount();

    expect(mockDispose).toHaveBeenCalled();
  });

  it("shows error state when initialization fails", async () => {
    const { createPluginUI } = await import("molstar/lib/mol-plugin-ui");
    vi.mocked(createPluginUI).mockRejectedValueOnce(
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

    // The expand button from ExpandableViewerWrapper should be present
    expect(
      screen.getByRole("button", { name: "Expand to full screen" }),
    ).toBeInTheDocument();
  });
});
