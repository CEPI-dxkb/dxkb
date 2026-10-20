import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import type { StructureSource } from "@/lib/protein-structure-view/source";
import { server } from "@/test-helpers/msw-server";

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
// Every structure file request, by URL (same-origin ones by path). The hook
// fetches the file itself and hands Mol* the contents.
const mockDownload = vi.fn<(url: string) => Response | Promise<Response>>();
// Mol* gets the downloaded contents; answering with them lets the parse
// assertions see exactly what was downloaded.
const mockRawData = vi.fn(({ data }: { data: unknown }) => Promise.resolve(data));
const mockParseTrajectory = vi.fn();
const mockApplyPreset = vi.fn();
const mockHandleResize = vi.fn();

const mockPlugin = {
  dispose: mockDispose,
  canvas3d: { handleResize: mockHandleResize },
  builders: {
    data: { rawData: mockRawData },
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

function requestedUrl(url: string): string {
  const parsed = new URL(url);
  return parsed.origin === window.location.origin
    ? `${parsed.pathname}${parsed.search}`
    : url;
}

/** What the app's routes answer when the upstream behind them is down. */
function routeFailure(error: string, status = 503): Response {
  return HttpResponse.json({ error, code: "service_unavailable" }, { status });
}

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
    server.use(
      http.get("*", ({ request }) => mockDownload(requestedUrl(request.url))),
    );
    mockDownload.mockImplementation(() => new Response("mock-data"));
    mockParseTrajectory.mockResolvedValue("mock-trajectory");
    mockApplyPreset.mockResolvedValue(undefined);
  });

  it("loads a direct URL using the source format", async () => {
    render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
    );

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith(
        "https://structures.example/model.cif",
      );
      expect(mockRawData).toHaveBeenCalledWith(
        { data: "mock-data", label: "model.cif" },
        { state: { isGhost: true } },
      );
      expect(mockParseTrajectory).toHaveBeenCalledWith("mock-data", "mmcif");
    });
  });

  it("falls back to the next source after a load failure", async () => {
    mockDownload
      .mockImplementationOnce(() => routeFailure("BV-BRC unavailable"))
      .mockImplementationOnce(() => new Response("fallback-data"));

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
        "/api/structure/model.pdb",
      );
      expect(mockDownload).toHaveBeenNthCalledWith(
        2,
        "https://files.rcsb.org/download/1ABC.cif",
      );
      expect(mockParseTrajectory).toHaveBeenCalledWith(
        "fallback-data",
        "mmcif",
      );
    });
  });

  it("announces why the file did not download instead of Mol*'s \"Invalid data cell.\"", async () => {
    mockDownload.mockImplementationOnce(() =>
      routeFailure(
        "The BV-BRC workspace service did not respond (timed out after 30 s).",
        504,
      ),
    );

    render(
      <StructureSourceViewer
        source={directSource({
          url: "/api/workspace/view/6VXX",
          format: "pdb",
          label: "6VXX",
          kind: "workspace",
        })}
        layout={testLayout}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not download 6VXX from your workspace: The BV-BRC workspace service did not respond (timed out after 30 s) (HTTP 504).",
      );
    });
    // Nothing was handed to Mol* to fail parsing.
    expect(mockRawData).not.toHaveBeenCalled();
    expect(mockParseTrajectory).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("restarts the fallback chain when retrying after all sources fail", async () => {
    const user = userEvent.setup();
    mockDownload
      .mockImplementationOnce(() => routeFailure("BV-BRC unavailable"))
      .mockImplementationOnce(() => routeFailure("RCSB unavailable"))
      .mockImplementationOnce(() => new Response("retry-data"));

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
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not download model.cif: RCSB unavailable (HTTP 503).",
      );
    });
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(mockDownload).toHaveBeenNthCalledWith(
        3,
        "/api/structure/model.pdb",
      );
    });
  });

  it("resets status and reloads when the source changes", async () => {
    let resolveSecondDownload: ((value: string) => void) | undefined;
    mockDownload
      .mockImplementationOnce(() => new Response("first-data"))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecondDownload = (body) => {
              resolve(new Response(body));
            };
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
        "https://structures.example/next.bcif",
      );
    });

    resolveSecondDownload?.("second-data");
    // BinaryCIF reaches Mol* as bytes, parsed as mmCIF.
    await waitFor(() => {
      expect(mockParseTrajectory).toHaveBeenCalledTimes(2);
    });
    const [contents, format] = mockParseTrajectory.mock.lastCall as [
      ArrayLike<number>,
      string,
    ];
    expect(typeof contents).not.toBe("string");
    // Compared as numbers: the response's bytes come from another realm than
    // jsdom's TextEncoder.
    expect(Array.from(contents)).toEqual(
      Array.from(new TextEncoder().encode("second-data")),
    );
    expect(format).toBe("mmcif");
  });

  it("resets status and disposes the failed plugin before retrying", async () => {
    const user = userEvent.setup();
    let resolveRetryDownload: ((value: string) => void) | undefined;
    mockDownload
      .mockImplementationOnce(() => HttpResponse.error())
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveRetryDownload = (body) => {
              resolve(new Response(body));
            };
          }),
      );

    render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /^Could not download model\.cif: \S/,
      );
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
    mockDownload.mockImplementationOnce(() => routeFailure("Network unavailable", 502));

    render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
    );

    // By the time the terminal error is on screen, the plugin (and its
    // WebGL context) must already be disposed — not merely disposed later
    // on retry or unmount.
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not download model.cif: Network unavailable (HTTP 502).",
      );
      expect(mockDispose).toHaveBeenCalledTimes(1);
    });

    // No further disposal should happen once the error state has settled.
    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it("does not double-dispose when unmounted while the download is still pending", async () => {
    const { createPluginUI } = await import("molstar/lib/mol-plugin-ui");
    let failDownload: (() => void) | undefined;
    mockDownload.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          failDownload = () => {
            resolve(routeFailure("Network unavailable"));
          };
        }),
    );

    const { unmount } = render(
      <StructureSourceViewer source={directSource()} layout={testLayout} />,
    );

    // Wait until the plugin has been created and the (still-pending)
    // download has been kicked off.
    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalled();
      expect(createPluginUI).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText("Initializing structure\u2026")).toBeInTheDocument();
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    unmount();

    // The effect cleanup disposes the plugin exactly once on unmount.
    expect(mockDispose).toHaveBeenCalledTimes(1);

    // The in-flight download now rejects *after* unmount. The async
    // catch's own disposal must see the lifecycle as already disposed and
    // skip disposing again — asserting on the call count (not just "no
    // throw") is what actually proves the race is closed.
    failDownload?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockDispose).toHaveBeenCalledTimes(1);
  });
});
