import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { StructureSource } from "@/lib/protein-structure-view/source";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { StructureSourceViewer } from "../structure-source-viewer";

const testLayout = { showControls: false, regionState: "hidden" } as const;

function directSource(
  overrides: Partial<StructureSource> = {},
): StructureSource {
  return {
    url: "https://structures.example/model.cif",
    format: "mmcif",
    label: "model.cif",
    kind: "url",
    ...overrides,
  };
}

describe("StructureSourceViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownload.mockResolvedValue("mock-data");
    mockParseTrajectory.mockResolvedValue("mock-trajectory");
    mockApplyPreset.mockResolvedValue(undefined);
  });

  it("loads a direct URL using the source format", async () => {
    render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
    );

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith(
        { url: "https://structures.example/model.cif", isBinary: false },
        { state: { isGhost: true } },
      );
      expect(mockParseTrajectory).toHaveBeenCalledWith("mock-data", "mmcif");
    });
  });

  it("falls back to the next source after a load failure", async () => {
    mockDownload
      .mockRejectedValueOnce(new Error("BV-BRC unavailable"))
      .mockResolvedValueOnce("fallback-data");

    render(
      <StructureSourceViewer
        source={directSource({
          url: "/api/structure/model.pdb",
          format: "pdb",
        })}
        sources={[
          directSource({ url: "/api/structure/model.pdb", format: "pdb" }),
          directSource({ url: "https://files.rcsb.org/download/1ABC.cif" }),
        ]}
        layout={testLayout}
      />,
    );

    await waitFor(() => {
      expect(mockDownload).toHaveBeenNthCalledWith(
        1,
        { url: "/api/structure/model.pdb", isBinary: false },
        { state: { isGhost: true } },
      );
      expect(mockDownload).toHaveBeenNthCalledWith(
        2,
        { url: "https://files.rcsb.org/download/1ABC.cif", isBinary: false },
        { state: { isGhost: true } },
      );
    });
  });

  it("restarts the fallback chain when retrying after all sources fail", async () => {
    const user = userEvent.setup();
    mockDownload
      .mockRejectedValueOnce(new Error("BV-BRC unavailable"))
      .mockRejectedValueOnce(new Error("RCSB unavailable"))
      .mockResolvedValueOnce("retry-data");

    render(
      <StructureSourceViewer
        source={directSource({
          url: "/api/structure/model.pdb",
          format: "pdb",
        })}
        sources={[
          directSource({ url: "/api/structure/model.pdb", format: "pdb" }),
          directSource({ url: "https://files.rcsb.org/download/1ABC.cif" }),
        ]}
        layout={testLayout}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("RCSB unavailable")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(mockDownload).toHaveBeenNthCalledWith(
        3,
        { url: "/api/structure/model.pdb", isBinary: false },
        { state: { isGhost: true } },
      );
    });
  });

  it("resets status and reloads when the source changes", async () => {
    let resolveSecondDownload: ((value: string) => void) | undefined;
    mockDownload.mockResolvedValueOnce("first-data").mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveSecondDownload = resolve;
        }),
    );

    const { rerender } = render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
    );

    await waitFor(() => {
      expect(mockApplyPreset).toHaveBeenCalledTimes(1);
    });

    rerender(
      <StructureSourceViewer
        source={directSource({
          url: "https://structures.example/next.bcif",
          format: "bcif",
          label: "next.bcif",
        })}
        layout={testLayout}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Initializing structure\u2026"),
      ).toBeInTheDocument();
      expect(mockDispose).toHaveBeenCalledTimes(1);
      expect(mockDownload).toHaveBeenLastCalledWith(
        { url: "https://structures.example/next.bcif", isBinary: true },
        { state: { isGhost: true } },
      );
    });

    resolveSecondDownload?.("second-data");
    await waitFor(() => {
      expect(mockParseTrajectory).toHaveBeenLastCalledWith(
        "second-data",
        "mmcif",
      );
    });
  });

  it("resets status and disposes the failed plugin before retrying", async () => {
    const user = userEvent.setup();
    let resolveRetryDownload: ((value: string) => void) | undefined;
    mockDownload
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveRetryDownload = resolve;
          }),
      );

    render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Network unavailable")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(
        screen.getByText("Initializing structure\u2026"),
      ).toBeInTheDocument();
      expect(mockDispose).toHaveBeenCalledTimes(1);
      expect(mockDownload).toHaveBeenCalledTimes(2);
    });

    resolveRetryDownload?.("retry-data");
    await waitFor(() => {
      expect(mockParseTrajectory).toHaveBeenLastCalledWith(
        "retry-data",
        "mmcif",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Hook lifecycle assertions migrated from the deleted `StructureViewer`
  // wrapper (removed as dead code — it was only reachable from its own test).
  // `useMolstarPlugin` is shared by this component and the dedicated
  // `/viewer/structure` route, so its dispose/error-handling guarantees stay
  // covered here rather than only through the now-gone wrapper.
  // -------------------------------------------------------------------------

  it("passes the layout spec through to createPluginUI", async () => {
    const { createPluginUI } = await import("molstar/lib/mol-plugin-ui");

    render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
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
                }) as Record<string, string>,
              }) as Record<string, unknown>,
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });
  });

  it("disposes the plugin on unmount", async () => {
    const { unmount } = render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
    );

    // Wait for plugin to be created
    await waitFor(() => {
      expect(mockApplyPreset).toHaveBeenCalled();
    });

    unmount();

    expect(mockDispose).toHaveBeenCalled();
  });

  it("shows error state when plugin initialization fails", async () => {
    const { createPluginUI } = await import("molstar/lib/mol-plugin-ui");
    vi.mocked(createPluginUI).mockRejectedValueOnce(
      new Error("WebGL not supported"),
    );

    render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
    );

    await waitFor(() => {
      expect(screen.getByText("WebGL not supported")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("disposes the plugin exactly once when the download fails", async () => {
    // Plugin creation succeeds (WebGL context allocated); the failure
    // happens afterwards, in the download step.
    mockDownload.mockRejectedValueOnce(new Error("Network unavailable"));

    render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
    );

    // By the time the terminal error is on screen, the plugin (and its
    // WebGL context) must already be disposed — not merely disposed later
    // on retry or unmount.
    await waitFor(() => {
      expect(screen.getByText("Network unavailable")).toBeInTheDocument();
      expect(mockDispose).toHaveBeenCalledTimes(1);
    });

    // No further disposal should happen once the error state has settled.
    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it("does not double-dispose when unmounted while the download is still pending", async () => {
    let rejectDownload: ((err: Error) => void) | undefined;
    mockDownload.mockImplementationOnce(
      () =>
        new Promise<string>((_resolve, reject) => {
          rejectDownload = reject;
        }),
    );

    const { unmount } = render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
    );

    // Wait until the plugin has been created and the (still-pending)
    // download has been kicked off.
    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalled();
    });

    unmount();

    // The effect cleanup disposes the plugin exactly once on unmount.
    expect(mockDispose).toHaveBeenCalledTimes(1);

    // The in-flight download now rejects *after* unmount. The async
    // catch's own disposal must see the lifecycle as already disposed and
    // skip disposing again — asserting on the call count (not just "no
    // throw") is what actually proves the race is closed.
    rejectDownload?.(new Error("Network unavailable"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockDispose).toHaveBeenCalledTimes(1);
  });
});
