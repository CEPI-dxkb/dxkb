import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, type JsonBodyType } from "msw";
import type { ReactNode } from "react";
import { server } from "@/test-helpers/msw-server";
import {
  createQueryClientWrapper,
  createUiPreferencesWrapper,
} from "@/test-helpers/react";
import { focusRow, mirroredRow } from "@/test-helpers/compare-region";
import { CompareRegionPanel } from "../compare-region-panel";

const search = vi.hoisted(() => ({ value: "" }));
const download = vi.hoisted(() => ({
  blob: vi.fn<(blob: Blob, fileName: string) => void>(),
}));

vi.mock("@/components/views/tab-content-search-params", () => ({
  useTabContentSearchParams: () => new URLSearchParams(search.value),
}));
// jsdom has no ResizeObserver and no layout: give the card a fixed width.
vi.mock("@visx/responsive", () => ({
  useParentSize: () => ({
    parentRef: { current: null },
    width: 900,
    height: 0,
  }),
}));
vi.mock("@/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils")>()),
  downloadBlob: download.blob,
}));
// Signed out (useAuth throws outside AuthBoundary).
vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
// The real selector searches the workspace on interaction (MSW is strict).
vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: ({ id, value }: { id?: string; value?: string }) => (
    <input id={id} value={value} readOnly />
  ),
}));
// jsdom has no canvas: the figure measures its labels with the estimate (D9).
vi.mock("@/lib/compare-region/text-measure", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/compare-region/text-measure")>();
  return { ...actual, canvasTextWidth: actual.estimateTextWidth };
});

const densityCookie = "dxkb-compare-region-density";
/** The figure, named for its genome count. */
const figureName = /^Compared regions of/;

function answer(body: JsonBodyType, status = 200) {
  const seen: URLSearchParams[] = [];
  server.use(
    http.get("/api/compare-region", ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return HttpResponse.json(body, { status });
    }),
  );
  return seen;
}

function renderPanel() {
  return render(<CompareRegionPanel patricId="fig|1.1.peg.2" />, {
    wrapper: createQueryClientWrapper(),
  });
}

beforeEach(() => {
  search.value = "";
  download.blob.mockReset();
});

afterEach(() => {
  document.cookie = `${densityCookie}=; Path=/; Max-Age=0`;
});

describe("CompareRegionPanel", () => {
  it("compares the focus gene with the default settings", async () => {
    const seen = answer({ rows: [focusRow, mirroredRow] });
    renderPanel();

    expect(
      await screen.findByRole("group", { name: "Compared regions of 2 genomes" }),
    ).toBeInTheDocument();
    expect(Object.fromEntries(seen.at(0) ?? [])).toEqual({
      peg: "fig|1.1.peg.2",
      size: "10000",
      genomes: "10",
      method: "pgfam",
      filter: "reference",
    });
  });

  it("draws the figure in a card, under the command bar", async () => {
    answer({ rows: [focusRow, mirroredRow] });
    renderPanel();

    await screen.findByRole("group", { name: figureName });
    const card = screen.getByRole("region", { name: "Compare regions" });
    expect(card).toHaveClass("border", "bg-card", "shadow-sm");
    // It fills the tab down to the page's bottom edge, as the data tables do:
    // rounded at the top only, open at the bottom, with no padding under it.
    expect(card).toHaveClass("flex-1", "rounded-t-xl", "border-b-0");
    expect(card).not.toHaveClass("rounded-xl");
    expect(card.parentElement).toHaveClass("pt-3");
    expect(card.parentElement).not.toHaveClass("py-3");
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export SVG" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Switch to Compact density" }),
    ).toBeInTheDocument();
  });

  it("re-joins the request in flight when the tab comes back", async () => {
    let calls = 0;
    // The service answers only once the tab is back.
    const serviceAnswers = Promise.withResolvers<undefined>();
    server.use(
      http.get("/api/compare-region", async () => {
        calls += 1;
        await serviceAnswers.promise;
        return HttpResponse.json({ rows: [focusRow] });
      }),
    );
    // One query client for both mounts, as on a tab switch.
    const wrapper = createQueryClientWrapper();
    const panel = <CompareRegionPanel patricId="fig|1.1.peg.2" />;
    const first = render(panel, { wrapper });
    await waitFor(() => {
      expect(calls).toBe(1);
    });

    first.unmount();
    render(panel, { wrapper });
    serviceAnswers.resolve(undefined);

    expect(await screen.findByRole("group", { name: figureName })).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it("says what it is doing while the service works", async () => {
    answer({ rows: [focusRow] });
    renderPanel();
    // Awaited, so the slider thumb measures itself inside act.
    const message = await screen.findByText(
      "Comparing regions across 10 genomes. This takes from a few seconds to over a minute.",
    );
    expect(message.closest('[role="status"]')).not.toBeNull();
    // The bar is there, but nothing to zoom or export yet.
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export SVG" })).toBeDisabled();
  });

  it("sends the settings the URL carries", async () => {
    search.value = "tab=compare-region&compare.genomes=20&compare.method=plfam";
    const seen = answer({ rows: [focusRow] });
    renderPanel();

    await screen.findByRole("group", { name: figureName });
    expect(seen.at(0)?.get("genomes")).toBe("20");
    expect(seen.at(0)?.get("method")).toBe("plfam");
  });

  it("compares against the workspace group the URL names", async () => {
    const group = "/u@bvbrc/home/Genome Groups/Escherichia";
    search.value = new URLSearchParams({
      tab: "compare-region",
      "compare.filter": "genomeGroup",
      "compare.group": group,
    }).toString();
    const seen = answer({ rows: [focusRow] });
    renderPanel();

    await screen.findByRole("group", { name: figureName });
    expect(seen.at(0)?.get("filter")).toBe("genomeGroup");
    expect(seen.at(0)?.get("group")).toBe(group);
    expect(
      screen.getByRole("button", {
        name: "Genomes: Genome group: Escherichia",
      }),
    ).toBeInTheDocument();
  });

  it("applies changed settings on Update only", async () => {
    const user = userEvent.setup();
    answer({ rows: [focusRow] });
    window.history.replaceState(
      null,
      "",
      "/feature/PATRIC.1?tab=compare-region",
    );
    const replace = vi.spyOn(window.history, "replaceState");
    renderPanel();
    await screen.findByRole("group", { name: figureName });

    const update = screen.getByRole("button", { name: "Update" });
    expect(update).toBeDisabled();
    await user.click(
      screen.getByRole("combobox", { name: "Number of genomes" }),
    );
    await user.click(await screen.findByRole("option", { name: "20 genomes" }));
    expect(replace).not.toHaveBeenCalled();
    await user.click(update);

    expect(replace).toHaveBeenCalledWith(
      null,
      "",
      "/feature/PATRIC.1?tab=compare-region&compare.genomes=20",
    );
    replace.mockRestore();
  });

  it("starts a fresh draft when the URL's settings change (back/forward)", async () => {
    const user = userEvent.setup();
    answer({ rows: [focusRow] });
    const { rerender } = renderPanel();
    await screen.findByRole("group", { name: figureName });
    await user.click(
      screen.getByRole("combobox", { name: "Number of genomes" }),
    );
    await user.click(await screen.findByRole("option", { name: "20 genomes" }));
    expect(screen.getByRole("button", { name: "Update" })).toBeEnabled();

    // Back to an address with other settings, the unapplied draft still open.
    search.value = "tab=compare-region&compare.method=plfam";
    rerender(<CompareRegionPanel patricId="fig|1.1.peg.2" />);
    await screen.findByRole("group", { name: figureName });

    expect(
      screen.getByRole("combobox", { name: "Number of genomes" }),
    ).toHaveTextContent("10 genomes");
    expect(screen.getByRole("button", { name: "PLfam" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
  });

  it("keeps an unapplied draft through a Retry that succeeds", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get("/api/compare-region", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              {
                error: "The compare region service is busy.",
                code: "server_busy",
              },
              { status: 503 },
            )
          : HttpResponse.json({ rows: [focusRow] });
      }),
    );
    renderPanel();
    await screen.findByRole("alert");
    await user.click(
      screen.getByRole("combobox", { name: "Number of genomes" }),
    );
    await user.click(await screen.findByRole("option", { name: "20 genomes" }));

    // The status gives way to the figure; the bar's draft stays.
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("group", { name: figureName });
    expect(calls).toBe(2);
    expect(
      screen.getByRole("combobox", { name: "Number of genomes" }),
    ).toHaveTextContent("20 genomes");
    expect(screen.getByRole("button", { name: "Update" })).toBeEnabled();
  });

  it("says to sign in, with no Retry, when a group needs a session", async () => {
    search.value = new URLSearchParams({
      tab: "compare-region",
      "compare.filter": "genomeGroup",
      "compare.group": "/u@bvbrc/home/Genome Groups/Escherichia",
    }).toString();
    answer(
      {
        error: "Sign in to compare against a workspace group.",
        code: "unauthorized",
      },
      401,
    );
    renderPanel();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Sign in to compare against a workspace group.",
    );
    expect(alert).toHaveTextContent(
      'Sign in, or choose "Reference & representative" or "All genomes" under Genomes.',
    );
    // Retrying would only answer 401 again.
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    // Signed out, Update stays off until a public source is chosen.
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
  });

  it("shows the service's own error with a Retry", async () => {
    answer(
      {
        error:
          "The compare region service is busy with other requests. Please try again in a minute.",
        code: "server_busy",
      },
      503,
    );
    renderPanel();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not compare regions");
    expect(alert).toHaveTextContent(/busy with other requests/);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    // Inside the card, below the bar.
    expect(
      screen.getByRole("region", { name: "Compare regions" }),
    ).toContainElement(alert);
  });

  it("says so when the service finds nothing to compare", async () => {
    answer({ rows: [] });
    renderPanel();
    const message = await screen.findByText(
      "No comparable regions were found for this gene.",
    );
    // The status area pads it, as it pads the Alert and the loading message.
    expect(message.className).not.toMatch(/\bp-\d/);
    expect(message.parentElement).toHaveClass("p-3");
  });

  it("switches the figure's density", async () => {
    const user = userEvent.setup();
    answer({ rows: [focusRow, mirroredRow] });
    renderPanel();
    const figure = await screen.findByRole("group", { name: figureName });
    const comfortableHeight = Number(figure.getAttribute("height"));

    await user.click(
      screen.getByRole("button", { name: "Switch to Compact density" }),
    );
    expect(
      screen.getByRole("button", { name: "Switch to Comfortable density" }),
    ).toBeInTheDocument();
    expect(Number(figure.getAttribute("height"))).toBeLessThan(
      comfortableHeight,
    );
  });

  it("keeps the density as a device preference (D10)", async () => {
    const user = userEvent.setup();
    answer({ rows: [focusRow, mirroredRow] });
    const Queries = createQueryClientWrapper();
    const Preferences = createUiPreferencesWrapper();
    render(<CompareRegionPanel patricId="fig|1.1.peg.2" />, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <Queries>
          <Preferences>{children}</Preferences>
        </Queries>
      ),
    });
    await screen.findByRole("group", { name: figureName });

    await user.click(
      screen.getByRole("button", { name: "Switch to Compact density" }),
    );
    // Preference cookies hold JSON.
    expect(decodeURIComponent(document.cookie)).toContain(
      `${densityCookie}="compact"`,
    );
  });

  it("exports the figure as an SVG file", async () => {
    const user = userEvent.setup();
    // jsdom has no canvas: the export's color converter finds no 2D context
    // and keeps the colors (the browser check covers the conversion).
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(null);
    try {
      answer({ rows: [focusRow, mirroredRow] });
      renderPanel();
      await screen.findByRole("group", { name: figureName });

      await user.click(screen.getByRole("button", { name: "Export SVG" }));

      expect(download.blob).toHaveBeenCalledWith(
        expect.any(Blob),
        "compare-regions-fig_1.1.peg.2.svg",
      );
      const [blob] = download.blob.mock.calls.at(0) ?? [];
      expect(blob?.type).toBe("image/svg+xml");
      expect(await blob?.text()).toContain(
        'xmlns="http://www.w3.org/2000/svg"',
      );
    } finally {
      getContext.mockRestore();
    }
  });
});
